const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3019;
const MongoClient = require('mongodb').MongoClient;

// Set up EJS as the template engine
app.set('view engine', 'ejs');

let client = new MongoClient('mongodb://localhost:27017/AirMon');


app.get("/", (req, res) => {
    client.connect((err, cl) => {
        if (err) {
            console.error("Error connecting to the database:", err);
            return res.status(500).send("Database connection error");
        }

        const db = cl.db('AirMon');

        db.collection('rooms').find().toArray((err, rooms) => {
            if (err) {
                console.error("Error querying the rooms collection:", err);
                return res.status(500).send("Error retrieving rooms data");
            }

            res.render("welcome.ejs", { rooms });
        });
    });
});


app.get('/room1', (req, res) => {

    let roomName="Room 1";
    client.connect((err, cl) => {
        if (err) throw err;
        const db = cl.db('AirMon');


        db.collection('tempOut').findOne({}, (err, tempOut) => {
            if (err) throw err;

            db.collection('rooms').findOne({ name: roomName }, (err, room) => {
                if (err) throw err;

                if (!room) {
                    res.status(404).send("Room not found");
                    return;
                }

                const roomId = room._id; 

                db.collection('heaters').find({ roomId }).toArray((err, heaters) => {
                    if (err) throw err;

                    db.collection('alertsAndNotifications').find({ roomId }).sort({ dateTime: -1 }).limit(1) .toArray((err, alerts) => { 
                        if (err) throw err;

                        db.collection('tempData').findOne({ roomId }, (err, tempData) => {
                            if (err) throw err;

                            res.render('mainPage.ejs', { heaters, alerts, tempOut, tempData, roomName });
                        });
                    });
                });
            });
        });
    });
});



app.get('/getTempData', (req, res) => {
    client.connect((err, cl) => {
        if (err) throw err;
        const db = cl.db('AirMon');
        
        db.collection('tempData')
            .find()
            .sort({ dateTime: -1 }) 
            .toArray((err, rows) => {
                if (err) throw err;
                
                res.render('tempTemplate.ejs', { rows: rows });
            });
    });
});



app.get('/getAlerts', (req, res) => {
    client.connect((err, cl) => {
        if (err) throw err;
        const db = cl.db('AirMon');

        // Get the current date and set time to 00:00:00 to compare only the date
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set the time to 00:00:00

        // Query the alerts collection
        db.collection('alertsAndNotifications')
            .find()
            .sort({ dateTime: -1 }) // Sort alerts by most recent
            .toArray((err, rows) => {
                if (err) throw err;

                // Calculate the total number of alerts
                const totalAlerts = rows.length;

                // Calculate the number of new alerts (alerts from today)
                const todaysAlerts = rows.filter(alert => {
                    const alertDate = new Date(alert.dateTime);
                    alertDate.setHours(0, 0, 0, 0); // Set the alert's time to 00:00:00 for comparison
                    return alertDate.getTime() === today.getTime(); // Compare only the date
                });

                // Number of new alerts from today
                const newAlerts = todaysAlerts.length;

                // Pass the necessary variables to the EJS template
                res.render('alerts.ejs', {
                    rows: rows,
                    totalAlerts: totalAlerts,
                    newAlerts: newAlerts > 0 ? newAlerts : 0 // Ensure that newAlerts is at least 0
                });
            });
    });
});




app.get('/getGraphs', async (req, res) => {
    client.connect(async (err, cl) => {
        if (err) throw err;
        const db = cl.db('AirMon');

        try {
            // Hourly Data
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            const logs = await db.collection('heatersLogs').find({
                DateTimeOn: { $gte: startOfDay, $lt: endOfDay }
            }).toArray();

            const energyPerHour = Array(24).fill(0);
            logs.forEach(log => {
                const onDate = new Date(log.DateTimeOn);
                const offDate = new Date(log.DateTimeOff);

                for (let hour = onDate.getHours(); hour <= offDate.getHours(); hour++) {
                    energyPerHour[hour] += log.energy || 0; // Accumulate energy
                }
            });

            // Monthly Data
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const logsByMonth = await db.collection('heatersLogs').aggregate([
                {
                    $match: {
                        DateTimeOn: { $gte: startOfYear }
                    }
                },
                {
                    $project: {
                        month: { $month: "$DateTimeOn" },
                        durationInSeconds: {
                            $divide: [
                                { $subtract: ["$DateTimeOff", "$DateTimeOn"] },
                                1000
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$month",
                        totalDurationInSeconds: { $sum: "$durationInSeconds" }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]).toArray();

            const energyPerMonth = new Array(12).fill(0); // Months from 1 to 12
            logsByMonth.forEach(({ _id, totalDurationInSeconds }) => {
                energyPerMonth[_id - 1] = totalDurationInSeconds / 3600; // Convert seconds to kWh
            });

            res.render('graphs.ejs', { energyPerHour, energyPerMonth });
        } catch (error) {
            console.error("Error fetching data:", error);
            res.status(500).send("Error processing data for the graph");
        }
    });
});




app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
