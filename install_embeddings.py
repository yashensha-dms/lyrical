import os
import sys

def main():
    print("Downloading and caching sentence-transformers model...")
    try:
        from sentence_transformers import SentenceTransformer
        # Load model, which automatically downloads and caches it
        model_name = "all-MiniLM-L6-v2"
        print(f"Loading {model_name}...")
        model = SentenceTransformer(model_name)
        print("Model loaded successfully and cached.")
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
