const https = require('https');
const { MongoClient, ObjectId } = require('mongodb');

// URL de la API de Visual Crossing para obtener el clima de Toulouse
const API_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/toulouse?unitGroup=metric&include=current&key=FWPF5XW7PLBZY43GZASMLJLN7&contentType=json";
let client = new MongoClient('mongodb://localhost:27017/AirMon', { useNewUrlParser: true, useUnifiedTopology: true });

// Función para hacer una solicitud HTTPS GET
const fetchData = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const parsedData = JSON.parse(data); // Parseamos los datos JSON
          resolve(parsedData); // Devolvemos los datos parseados
        } catch (error) {
          reject('Error al parsear los datos JSON');
        }
      });
    }).on('error', (err) => {
      reject(err); // En caso de error con la solicitud
    });
  });
};

// Función para obtener la temperatura y actualizar la base de datos
const fetchTemperature = async () => {
  try {
    // Hacemos la solicitud a la API de Visual Crossing para obtener los datos del clima
    const weatherResponse = await fetchData(API_URL);

    // Verificamos si la respuesta contiene datos actuales
    if (!weatherResponse.currentConditions) {
      console.log("Datos del clima no disponibles.");
      return;
    }

    // Obtenemos la temperatura actual de la respuesta
    const temperature = weatherResponse.currentConditions.temp;

    // Establecer la fecha y hora actual como el timestamp
    const timestamp = new Date();

    // Conectar a la base de datos MongoDB
    await client.connect();
    const db = client.db('AirMon');

    // Actualizar el documento en la colección 'tempOut'
    const result = await db.collection('tempOut').updateOne(
      { _id: ObjectId("673f0c5f5a30cbc3afb724dd") },
      {
        $set: {
          temp: temperature,
          timeStamp: timestamp  // Establecer el timestamp como la hora actual
        }
      }
    );

    // Mostramos la temperatura y el timestamp en la terminal
    console.log(`Temperatura actual: ${temperature}°C, Timestamp: ${timestamp}`);

  } catch (error) {
    console.error('Error al obtener la temperatura o actualizar la base de datos:', error);
  }
};

// Ejecutar la función cada 5 minutos (300000 milisegundos)
setInterval(fetchTemperature, 300000); // 300000 ms = 5 minutos

// Ejecutar la primera vez inmediatamente
fetchTemperature();
