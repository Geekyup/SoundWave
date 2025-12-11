import time
import functools

def measure_time(func):
    """
    Декоратор для измерения времени выполнения функции.
    Выводит имя функции и время выполнения в консоль.
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        total_time = end_time - start_time
        
        print(f"Функция '{func.__name__}' выполнена за {total_time:.5f} секунд")
        
        return result
    
    return wrapper

