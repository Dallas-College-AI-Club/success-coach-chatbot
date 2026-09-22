"""
===============================================================================
Batch Syllabus Preprocessor CLI Driver (Backward Compatibility Alias)
===============================================================================
Author: Antigravity AI / Neftali
Project: Success Coach Chatbot (Issue #90 - Data Preprocessing Engine)

Description:
    Alias wrapper pointing to `preprocess_html.py` for processing HTML documents.
===============================================================================
"""

try:
    from dallasai.pipeline.preprocess_html import batch_preprocess_html, main
except ModuleNotFoundError:
    from apps.data.dallasai.pipeline.preprocess_html import batch_preprocess_html, main

# Alias for backward compatibility
batch_preprocess_syllabi = batch_preprocess_html

if __name__ == "__main__":
    main()
