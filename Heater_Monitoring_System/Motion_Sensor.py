import RPi.GPIO as GPIO
import time
from pymongo import MongoClient
import serial
from bson.objectid import ObjectId

GPIO.cleanup()
GPIO.setmode(GPIO.BOARD)
GPIO.setup(12, GPIO.IN)

PortRF = serial.Serial('/dev/ttyAMA0',9600)
client = MongoClient('mongodb://etu-web2.ut-capitole.fr:27017/')

db = client.AirMon

PIN_Motion = 12

roomId = ObjectId("000000000000000000000000")

while True:
        if(GPIO.input(PIN_Motion)) :
                print("Movement detected")
                db.rooms.update_one({"_id":roomId},{'$set':{"motion":True}})
                time.sleep(300)
        else :
                db.rooms.update_one({"_id":roomId},{'$set':{"motion":False}})
