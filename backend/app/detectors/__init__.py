from app.detectors.base import ContextPatternDetector, AnalysisResult
from app.detectors.full_context import FullContextDetector
from app.detectors.sliding_window import SlidingWindowDetector
from app.detectors.summarization import SummarizationDetector

# Registry of all detectors
DETECTORS = [
    FullContextDetector(),
    SlidingWindowDetector(),
    SummarizationDetector(),
]


def get_detectors():
    """Get all registered detectors"""
    return DETECTORS


def register_detector(detector: ContextPatternDetector):
    """Register a new detector"""
    DETECTORS.append(detector)
