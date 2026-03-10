"""Quick import test for backend/main.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
os.chdir(os.path.join(os.path.dirname(__file__), "backend"))

try:
    import main
    print("IMPORT OK")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"\nERROR: {e}")
