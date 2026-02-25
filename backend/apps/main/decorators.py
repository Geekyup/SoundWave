import time
import functools

def measure_time(func):
    """
    A decorator for measuring function execution time.
    It prints the function name and execution time to the console.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        total_time = end_time - start_time

        print(f"The function '{func.__name__}' was executed in {total_time:.5f} seconds")

        return result
    
    return wrapper

