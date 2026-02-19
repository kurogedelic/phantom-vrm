#!/usr/bin/env python3
"""
MachineMusic WAV File Quality Analyzer

Analyzes WAV files for:
1. Silence detection (continuous silence periods)
2. Loudness metrics (RMS, Peak, LUFS)
3. Clipping detection (digital distortion)
4. Spectrum analysis (frequency distribution graph)

Usage:
    python audio_analyzer.py <wav_file>       # Analyze single file
    python audio_analyzer.py --all            # Analyze all files in samples/
    python audio_analyzer.py --all --samples-dir /custom/path  # Custom samples directory
"""

import argparse
import os
import sys
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for headless operation


# Configuration
DEFAULT_SAMPLES_DIR = "/tmp/MachineMusic/samples"
DEFAULT_OUTPUT_DIR = "analysis"

# Analysis thresholds
SILENCE_THRESHOLD_DB = -60  # dBFS below this is considered silence
MIN_SILENCE_DURATION_SEC = 0.5  # Minimum silence duration to report
CLIPPING_THRESHOLD = 0.99  # Samples above this are considered clipped
LUFS_REFERENCE = -23  # Target LUFS level


@dataclass
class SilenceEvent:
    """Represents a detected silence period."""
    start_time: float
    end_time: float
    duration: float


@dataclass
class LoudnessMetrics:
    """Loudness measurements."""
    rms_db: float
    peak_db: float
    peak_amplitude: float
    lufs_estimate: float
    dynamic_range: float


@dataclass
class ClippingInfo:
    """Clipping detection results."""
    clipped_samples: int
    total_samples: int
    clip_ratio: float
    clipped_regions: List[Tuple[float, float]]


@dataclass
class AnalysisResult:
    """Complete analysis result for a single file."""
    filename: str
    sample_rate: int
    duration: float
    channels: int
    silence_events: List[SilenceEvent]
    loudness: LoudnessMetrics
    clipping: ClippingInfo
    spectrum_path: Optional[str] = None
    warnings: List[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


def db_from_amplitude(amplitude: float) -> float:
    """Convert amplitude to dB."""
    if amplitude <= 0:
        return -np.inf
    return 20 * np.log10(amplitude)


def calculate_rms(audio: np.ndarray) -> float:
    """Calculate RMS value of audio."""
    return np.sqrt(np.mean(audio.astype(np.float64) ** 2))


def calculate_peak(audio: np.ndarray) -> float:
    """Calculate peak amplitude."""
    return np.max(np.abs(audio))


def calculate_lufs_estimate(audio: np.ndarray, sample_rate: int) -> float:
    """
    Estimate LUFS (Loudness Units Full Scale).
    This is a simplified calculation - true LUFS requires K-weighting filter.
    """
    # Simple estimate: RMS-based with approximate correction
    rms = calculate_rms(audio)
    if rms <= 0:
        return -np.inf
    
    # Approximate LUFS from RMS (rough estimate)
    # True LUFS would require proper K-weighting filter
    rms_db = db_from_amplitude(rms)
    # Offset correction for approximate LUFS
    lufs_estimate = rms_db - 3  # Rough approximation
    return lufs_estimate


def detect_silence(audio: np.ndarray, sample_rate: int, 
                   threshold_db: float = SILENCE_THRESHOLD_DB,
                   min_duration: float = MIN_SILENCE_DURATION_SEC) -> List[SilenceEvent]:
    """
    Detect periods of silence in the audio.
    
    Args:
        audio: Audio samples
        sample_rate: Sample rate in Hz
        threshold_db: Threshold in dB below which is considered silence
        min_duration: Minimum silence duration in seconds to report
    
    Returns:
        List of SilenceEvent objects
    """
    threshold_amp = 10 ** (threshold_db / 20)
    
    # Handle stereo by taking max across channels
    if len(audio.shape) > 1:
        audio_mono = np.max(np.abs(audio), axis=1)
    else:
        audio_mono = np.abs(audio)
    
    # Find silent samples
    is_silent = audio_mono < threshold_amp
    
    # Find silence region boundaries
    silence_events = []
    in_silence = False
    silence_start = 0
    
    for i, silent in enumerate(is_silent):
        if silent and not in_silence:
            # Start of silence
            in_silence = True
            silence_start = i
        elif not silent and in_silence:
            # End of silence
            in_silence = False
            duration_samples = i - silence_start
            duration_sec = duration_samples / sample_rate
            
            if duration_sec >= min_duration:
                silence_events.append(SilenceEvent(
                    start_time=silence_start / sample_rate,
                    end_time=i / sample_rate,
                    duration=duration_sec
                ))
    
    # Handle silence at end of file
    if in_silence:
        duration_samples = len(is_silent) - silence_start
        duration_sec = duration_samples / sample_rate
        if duration_sec >= min_duration:
            silence_events.append(SilenceEvent(
                start_time=silence_start / sample_rate,
                end_time=len(is_silent) / sample_rate,
                duration=duration_sec
            ))
    
    return silence_events


def detect_clipping(audio: np.ndarray, sample_rate: int,
                    threshold: float = CLIPPING_THRESHOLD) -> ClippingInfo:
    """
    Detect clipped samples in the audio.
    
    Args:
        audio: Audio samples
        sample_rate: Sample rate in Hz
        threshold: Amplitude threshold for clipping detection
    
    Returns:
        ClippingInfo object with clipping details
    """
    # Handle stereo
    if len(audio.shape) > 1:
        audio_abs = np.max(np.abs(audio), axis=1)
    else:
        audio_abs = np.abs(audio)
    
    # Find clipped samples
    clipped_mask = audio_abs >= threshold
    clipped_samples = np.sum(clipped_mask)
    total_samples = len(audio_abs)
    
    # Find clipped regions
    clipped_regions = []
    in_clip = False
    clip_start = 0
    
    for i, clipped in enumerate(clipped_mask):
        if clipped and not in_clip:
            in_clip = True
            clip_start = i
        elif not clipped and in_clip:
            in_clip = False
            clipped_regions.append((
                clip_start / sample_rate,
                i / sample_rate
            ))
    
    if in_clip:
        clipped_regions.append((
            clip_start / sample_rate,
            len(clipped_mask) / sample_rate
        ))
    
    return ClippingInfo(
        clipped_samples=clipped_samples,
        total_samples=total_samples,
        clip_ratio=clipped_samples / total_samples if total_samples > 0 else 0,
        clipped_regions=clipped_regions
    )


def calculate_loudness(audio: np.ndarray, sample_rate: int) -> LoudnessMetrics:
    """
    Calculate loudness metrics for the audio.
    
    Args:
        audio: Audio samples (normalized to -1.0 to 1.0)
        sample_rate: Sample rate in Hz
    
    Returns:
        LoudnessMetrics object
    """
    # RMS
    rms = calculate_rms(audio)
    rms_db = db_from_amplitude(rms)
    
    # Peak
    peak_amp = calculate_peak(audio)
    peak_db = db_from_amplitude(peak_amp)
    
    # LUFS estimate
    lufs = calculate_lufs_estimate(audio, sample_rate)
    
    # Dynamic range (crest factor)
    if rms > 0:
        dynamic_range = peak_db - rms_db
    else:
        dynamic_range = np.inf
    
    return LoudnessMetrics(
        rms_db=rms_db,
        peak_db=peak_db,
        peak_amplitude=peak_amp,
        lufs_estimate=lufs,
        dynamic_range=dynamic_range
    )


def generate_spectrum_plot(audio: np.ndarray, sample_rate: int, 
                          filename: str, output_dir: Path) -> str:
    """
    Generate spectrum analysis plot and save to file.
    
    Args:
        audio: Audio samples
        sample_rate: Sample rate in Hz
        filename: Original filename for title
        output_dir: Output directory for the plot
    
    Returns:
        Path to saved plot file
    """
    # Handle stereo - convert to mono
    if len(audio.shape) > 1:
        audio_mono = np.mean(audio, axis=1)
    else:
        audio_mono = audio
    
    # Create figure with subplots
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle(f'Audio Analysis: {filename}', fontsize=14, fontweight='bold')
    
    # 1. Waveform
    ax1 = axes[0, 0]
    time = np.arange(len(audio_mono)) / sample_rate
    ax1.plot(time, audio_mono, linewidth=0.5, alpha=0.7)
    ax1.set_xlabel('Time (s)')
    ax1.set_ylabel('Amplitude')
    ax1.set_title('Waveform')
    ax1.grid(True, alpha=0.3)
    ax1.set_xlim(0, time[-1])
    
    # 2. Spectrogram
    ax2 = axes[0, 1]
    f, t, Sxx = spectrogram(audio_mono, sample_rate, nperseg=2048, noverlap=1024)
    # Convert to dB
    Sxx_db = 10 * np.log10(Sxx + 1e-10)
    pcm = ax2.pcolormesh(t, f, Sxx_db, shading='gouraud', cmap='viridis')
    ax2.set_ylabel('Frequency (Hz)')
    ax2.set_xlabel('Time (s)')
    ax2.set_title('Spectrogram')
    ax2.set_ylim(0, sample_rate / 2)
    plt.colorbar(pcm, ax=ax2, label='Power (dB)')
    
    # 3. Frequency Spectrum (FFT)
    ax3 = axes[1, 0]
    # Use FFT for frequency analysis
    fft_size = min(len(audio_mono), 65536)
    fft_result = np.fft.rfft(audio_mono[:fft_size])
    fft_freq = np.fft.rfftfreq(fft_size, 1/sample_rate)
    fft_magnitude = np.abs(fft_result)
    fft_db = 20 * np.log10(fft_magnitude + 1e-10)
    
    ax3.plot(fft_freq, fft_db, linewidth=0.5)
    ax3.set_xlabel('Frequency (Hz)')
    ax3.set_ylabel('Magnitude (dB)')
    ax3.set_title('Frequency Spectrum')
    ax3.set_xlim(20, sample_rate / 2)
    ax3.grid(True, alpha=0.3)
    ax3.set_xscale('log')
    
    # 4. Level histogram
    ax4 = axes[1, 1]
    levels_db = 20 * np.log10(np.abs(audio_mono) + 1e-10)
    ax4.hist(levels_db, bins=100, range=(-100, 0), color='steelblue', edgecolor='none')
    ax4.axvline(x=-60, color='red', linestyle='--', alpha=0.7, label='Silence threshold')
    ax4.axvline(x=-1, color='orange', linestyle='--', alpha=0.7, label='Near clipping')
    ax4.set_xlabel('Level (dBFS)')
    ax4.set_ylabel('Sample count')
    ax4.set_title('Level Distribution')
    ax4.legend(fontsize=8)
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save plot
    output_path = output_dir / f"{Path(filename).stem}_analysis.png"
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    
    return str(output_path)


def analyze_wav_file(filepath: Path, output_dir: Optional[Path] = None) -> AnalysisResult:
    """
    Analyze a single WAV file.
    
    Args:
        filepath: Path to WAV file
        output_dir: Directory for output files (optional)
    
    Returns:
        AnalysisResult object
    """
    warnings = []
    
    # Read WAV file
    try:
        sample_rate, audio = wavfile.read(str(filepath))
    except Exception as e:
        raise ValueError(f"Failed to read WAV file: {e}")
    
    # Get audio info
    if len(audio.shape) > 1:
        channels = audio.shape[1]
    else:
        channels = 1
    
    duration = len(audio) / sample_rate
    
    # Normalize to float in range -1.0 to 1.0
    if audio.dtype == np.int16:
        audio_float = audio.astype(np.float64) / 32768.0
    elif audio.dtype == np.int32:
        audio_float = audio.astype(np.float64) / 2147483648.0
    elif audio.dtype == np.float32 or audio.dtype == np.float64:
        audio_float = audio.astype(np.float64)
    else:
        audio_float = audio.astype(np.float64)
        warnings.append(f"Unusual audio dtype: {audio.dtype}")
    
    # Perform analysis
    silence_events = detect_silence(audio_float, sample_rate)
    loudness = calculate_loudness(audio_float, sample_rate)
    clipping = detect_clipping(audio_float, sample_rate)
    
    # Generate spectrum plot if output directory specified
    spectrum_path = None
    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        spectrum_path = generate_spectrum_plot(audio_float, sample_rate, 
                                               filepath.name, output_dir)
    
    # Generate warnings based on analysis
    if silence_events:
        max_silence = max(e.duration for e in silence_events)
        if max_silence > 2.0:
            warnings.append(f"Long silence detected: {max_silence:.1f}s")
    
    if loudness.peak_db > -0.5:
        warnings.append("Audio is very close to 0dB (potential clipping)")
    
    if clipping.clip_ratio > 0.001:
        warnings.append(f"Clipping detected: {clipping.clip_ratio*100:.2f}% of samples")
    
    if loudness.dynamic_range < 3:
        warnings.append("Low dynamic range (over-compressed?)")
    elif loudness.dynamic_range > 25:
        warnings.append("High dynamic range (may need compression)")
    
    if loudness.lufs_estimate < -30:
        warnings.append("Audio is very quiet")
    elif loudness.lufs_estimate > -6:
        warnings.append("Audio is very loud")
    
    return AnalysisResult(
        filename=filepath.name,
        sample_rate=sample_rate,
        duration=duration,
        channels=channels,
        silence_events=silence_events,
        loudness=loudness,
        clipping=clipping,
        spectrum_path=spectrum_path,
        warnings=warnings
    )


def print_analysis_result(result: AnalysisResult, verbose: bool = True):
    """Print analysis result to console."""
    print(f"\n{'='*60}")
    print(f"File: {result.filename}")
    print(f"{'='*60}")
    
    # Basic info
    print(f"\n📊 Basic Info:")
    print(f"   Duration: {result.duration:.2f}s")
    print(f"   Sample Rate: {result.sample_rate} Hz")
    print(f"   Channels: {result.channels}")
    
    # Loudness
    print(f"\n🔊 Loudness Metrics:")
    print(f"   RMS Level: {result.loudness.rms_db:.1f} dBFS")
    print(f"   Peak Level: {result.loudness.peak_db:.1f} dBFS")
    print(f"   Peak Amplitude: {result.loudness.peak_amplitude:.4f}")
    print(f"   LUFS (est.): {result.loudness.lufs_estimate:.1f} LUFS")
    print(f"   Dynamic Range: {result.loudness.dynamic_range:.1f} dB")
    
    # Clipping
    print(f"\n⚡ Clipping Analysis:")
    if result.clipping.clip_ratio > 0:
        print(f"   ⚠️  Clipped samples: {result.clipping.clipped_samples:,} / {result.clipping.total_samples:,}")
        print(f"   ⚠️  Clip ratio: {result.clipping.clip_ratio*100:.4f}%")
        if result.clipping.clipped_regions and verbose:
            print(f"   Clipped regions:")
            for start, end in result.clipping.clipped_regions[:5]:
                print(f"      {start:.3f}s - {end:.3f}s")
            if len(result.clipping.clipped_regions) > 5:
                print(f"      ... and {len(result.clipping.clipped_regions) - 5} more")
    else:
        print(f"   ✅ No clipping detected")
    
    # Silence
    print(f"\n🤫 Silence Detection:")
    if result.silence_events:
        total_silence = sum(e.duration for e in result.silence_events)
        silence_ratio = total_silence / result.duration
        print(f"   Found {len(result.silence_events)} silence period(s)")
        print(f"   Total silence: {total_silence:.2f}s ({silence_ratio*100:.1f}% of file)")
        if verbose:
            print(f"   Silence events:")
            for event in result.silence_events[:5]:
                print(f"      {event.start_time:.2f}s - {event.end_time:.2f}s ({event.duration:.2f}s)")
            if len(result.silence_events) > 5:
                print(f"      ... and {len(result.silence_events) - 5} more")
    else:
        print(f"   ✅ No significant silence detected")
    
    # Warnings
    if result.warnings:
        print(f"\n⚠️  Warnings:")
        for warning in result.warnings:
            print(f"   • {warning}")
    
    # Spectrum path
    if result.spectrum_path:
        print(f"\n📈 Spectrum plot saved: {result.spectrum_path}")
    
    print(f"\n{'='*60}")


def main():
    parser = argparse.ArgumentParser(
        description="MachineMusic WAV File Quality Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python audio_analyzer.py mysong.wav
    python audio_analyzer.py --all
    python audio_analyzer.py --all --samples-dir /path/to/samples
        """
    )
    
    parser.add_argument('file', nargs='?', help='WAV file to analyze')
    parser.add_argument('--all', action='store_true', 
                       help='Analyze all WAV files in samples directory')
    parser.add_argument('--samples-dir', default=DEFAULT_SAMPLES_DIR,
                       help=f'Directory containing WAV samples (default: {DEFAULT_SAMPLES_DIR})')
    parser.add_argument('--output-dir', default=None,
                       help='Output directory for analysis plots (default: <samples-dir>/analysis)')
    parser.add_argument('--quiet', '-q', action='store_true',
                       help='Minimal output (only warnings and errors)')
    
    args = parser.parse_args()
    
    # Determine files to analyze
    if args.all:
        samples_dir = Path(args.samples_dir)
        if not samples_dir.exists():
            print(f"Error: Samples directory not found: {samples_dir}", file=sys.stderr)
            sys.exit(1)
        
        wav_files = list(samples_dir.glob("*.wav"))
        if not wav_files:
            print(f"Error: No WAV files found in {samples_dir}", file=sys.stderr)
            sys.exit(1)
        
        # Set output directory
        if args.output_dir:
            output_dir = Path(args.output_dir)
        else:
            output_dir = samples_dir / DEFAULT_OUTPUT_DIR
    elif args.file:
        wav_files = [Path(args.file)]
        if args.output_dir:
            output_dir = Path(args.output_dir)
        else:
            output_dir = wav_files[0].parent / DEFAULT_OUTPUT_DIR
    else:
        parser.print_help()
        sys.exit(1)
    
    # Analyze files
    results = []
    errors = []
    
    for wav_file in wav_files:
        try:
            result = analyze_wav_file(wav_file, output_dir)
            results.append(result)
            if not args.quiet:
                print_analysis_result(result)
        except Exception as e:
            errors.append((wav_file, str(e)))
            print(f"Error analyzing {wav_file}: {e}", file=sys.stderr)
    
    # Summary for batch analysis
    if args.all and len(results) > 1:
        print(f"\n{'#'*60}")
        print("SUMMARY")
        print(f"{'#'*60}")
        print(f"\nAnalyzed {len(results)} file(s) successfully")
        if errors:
            print(f"Failed to analyze {len(errors)} file(s)")
        
        # Find files with issues
        problem_files = [r for r in results if r.warnings]
        if problem_files:
            print(f"\nFiles with potential issues:")
            for r in problem_files:
                print(f"  • {r.filename}: {len(r.warnings)} warning(s)")
        
        # Loudness ranking
        print(f"\nLoudness ranking (by LUFS):")
        sorted_results = sorted(results, key=lambda r: r.loudness.lufs_estimate, reverse=True)
        for r in sorted_results:
            print(f"  {r.loudness.lufs_estimate:6.1f} LUFS  -  {r.filename}")
    
    # Exit with error code if any failures
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
