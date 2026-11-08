import numpy as np
from scipy.optimize import least_squares

# Define your fixed anchor positions globally
# (Modify these coordinates to match your physical setup)
ANCHORS = np.array([
    [0.0, 2.0],   # Anchor 1
    [-1.5, -2.0],  # Anchor 2
    [1.5, -2.0]    # Anchor 3
])

def trilateration_residuals(point, anchors, distances):
    """Calculates the difference between guessed distances and measured distances."""
    calculated_distances = np.linalg.norm(anchors - point, axis=1)
    return calculated_distances - distances

def estimate_point(distances, anchors=ANCHORS):
    """
    Takes 3 distances as input and estimates the unknown point's location.
    """
    # Convert input to a numpy array
    measured_distances = np.array(distances)
    
    # Use the center point of the anchors as a smart starting guess
    initial_guess = np.mean(anchors, axis=0)
    
    # Run the non-linear least squares optimization
    result = least_squares(trilateration_residuals, initial_guess, args=(anchors, measured_distances))
    
    if result.success:
        return result.x
    else:
        raise ValueError("Optimization failed to converge. Check your distance inputs.")
