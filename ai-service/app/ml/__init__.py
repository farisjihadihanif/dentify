"""
Dentify OpenCV preprocessing, custom Keras model, urgency engine, and CV inference package.

Submodules are imported directly (e.g. `app.ml.custom_model`). This package deliberately does not
re-export them: `custom_model` imports TensorFlow, and the TFLite serving path must not load it.
"""
