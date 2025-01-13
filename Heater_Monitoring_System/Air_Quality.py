import time
import bme680
from pymongo import MongoClient
import serial
from bson import ObjectId
import datetime

PortRF = serial.Serial('/dev/ttyAMA0',9600)
client = MongoClient('mongodb://etu-web2.ut-capitole.fr:27017/')

db = client.AirMon

# Initialize the sensor
sensor = bme680.BME680()

#Configure the sensor (optimal setings)
sensor.set_humidity_oversample(bme680.OS_2X)
sensor.set_temperature_oversample(bme680.OS_2X)
sensor.set_pressure_oversample(bme680.OS_4X)
sensor.set_filter(bme680.FILTER_SIZE_3)

roomId = ObjectId("000000000000000000000000")
increase = 0

def checkAirQuality(gasResistence, dateTime) :
        if(gasResistence<10000) :
                db.alertsAndNotifications.insert_one({"roomId":roomId,"dateTime":dateTime,"alertType":"AirContamination","Description":"Ventilation needed. The air in the room is not optimal."})
                db.rooms.update_one({"_id":roomId},{'$set':{"airQuality":False}})
        else :
                db.rooms.update_one({"_id":roomId},{'$set':{"airQuality":True}})

def checkTemp(temperature, dateTime) :
        if(temperature + increase>40) :
                db.alertsAndNotifications.insert_one({"roomId":roomId,"dateTime":dateTime,"alertType":"HighTemperature","Description":"Ventilation needed. The temperature in the room is too high."})
        elif(temperature + increase<10) :
                db.alertsAndNotifications.insert_one({"roomId":roomId,"dateTime":dateTime,"alertType":"LowTemperature","Description":"The heaters might be broken in the room. The temperature is too Low"})

while True:
        if sensor.get_sensor_data() :
                print("The sensor captured data")
                temperature = sensor.data.temperature
                gasResistence = sensor.data.gas_resistance
                dateTime = datetime.datetime.now()
                heater = db.heaters.find_one({"roomId":roomId})
                if(heater["status"]==True) :
                        increase = increase + 2
                        db.tempData.insert_one({"roomId":roomId,"temperature":temperature + increase,"gasResistence":gasResistence,"dateTime":dateTime})
                        print(temperature + increase)
                else :
                        increase = increase - 2
                        db.tempData.insert_one({"roomId":roomId,"temperature":temperature + increase,"gasResistence":gasResistence, "dateTime":dateTime})
                        print(temperature + increase)
                checkAirQuality(gasResistence, dateTime)
                checkTemp(temperature, dateTime)
        else:
                print("Sensor data not ready, retrying...")
        time.sleep(2)
