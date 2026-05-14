from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np

app = Flask(__name__)

# Load model
model = tf.keras.models.load_model("mkc.h5")

# Labels
labels = ["LOW", "MEDIUM", "HIGH", "SEVERE"]

@app.route('/predict', methods=['POST'])
def predict():

    data = request.get_json()

    vehicle_count = data['vehicleCount']
    avg_speed = data['avgSpeed']
    weather = data['weather']

    # reshape for model (1, 1, 3)
    input_data = np.array([[[vehicle_count, avg_speed, weather]]], dtype=np.float32)

    prediction = model.predict(input_data)

    predicted_class = np.argmax(prediction)

    result = labels[predicted_class]

    return jsonify({
        "traffic": result,
        "prediction": prediction.tolist()
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)