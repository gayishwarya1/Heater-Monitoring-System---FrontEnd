import RPi.GPIO as GPIO
import time
from pymongo import MongoClient
import serial
from bson import ObjectId
import datetime

PortRF = serial.Serial('/dev/ttyAMA0',9600)
client = MongoClient('mongodb://etu-web2.ut-capitole.fr:27017/')

db = client.AirMon

GPIO.cleanup()
GPIO.setmode(GPIO.BOARD)
GPIO.setup(18, GPIO.OUT)
GPIO.setup(22, GPIO.OUT)
GPIO.setup(36, GPIO.OUT)

pins = [18,22,36]
heatersIdPin = {}
heatersIdLog = {}
roomId = ObjectId("000000000000000000000000")
pHeater = 0.5025
tempOutId = ObjectId("673f0c5f5a30cbc3afb724dd")

def findHeaters(Id):
        pinsCopy = pins
        objects = db.heaters.find({"roomId":Id})
        for object in objects :
                heatersIdPin[object["_id"]] = pinsCopy[0]
                pinsCopy.pop(0)
                heatersIdLog[object["_id"]] = None

def calculateEnergy(heaterId) :
        log = db.heatersLogs.find_one({"_id":heatersIdLog[heaterId]})
        if log is not None :
                diference = ((log["DateTimeOff"]-log["DateTimeOn"]).total_seconds())/3600
                energy = diference * pHeater
                db.heatersLogs.update_one({"_id":heatersIdLog[heaterId]},{'$set':{"energy":energy}})

def heaterLogOn(heaterId) :
        heater = db.heaters.find_one({"_id":heaterId})
        if(heater["status"]==False) :
                db.heaters.update_one({"_id":heaterId},{'$set':{"status":True}})
                log = db.heatersLogs.insert_one({"heaterId":heaterId,"DateTimeOn":datetime.datetime.now()})
                GPIO.output(heatersIdPin[heaterId], GPIO.HIGH)
                heatersIdLog[heaterId] = log.inserted_id
                print(f"heater {heaterId} turned on")

def heaterLogOff(heaterId) :
        heater = db.heaters.find_one({"_id":heaterId})
        if(heater["status"]==True) :
                db.heaters.update_one({"_id":heaterId},{'$set':{"status":False}})
                db.heatersLogs.update_one({"_id":heatersIdLog[heaterId]},{'$set':{"DateTimeOff":datetime.datetime.now()}})
                calculateEnergy(heaterId)
                GPIO.output(heatersIdPin[heaterId], GPIO.LOW)
                print(f"heater {heaterId} turned off")

findHeaters(roomId)

while True:
        infoTemp = db.tempData.find_one({"roomId":roomId},sort=[("dateTime", -1)],projection = {"_id":0,"temperature":1,"gasResistence":1})
        infoRoom = db.rooms.find_one({"_id":roomId},projection = {"_id":0, "motion":1, "airQuality" : 1})
        tempOut =  db.tempOut.find_one({"_id":tempOutId})
        for heaterId in heatersIdPin :
                if(infoTemp["temperature"]>60 or tempOut["temp"]>25 or infoRoom["airQuality"]==False or infoRoom["manual"]==True): #or infoRoom["motion"]==False) :
                        heaterLogOff(heaterId)
                elif(infoTemp["temperature"]<40) :
                        heaterLogOn(heaterId)
        #time.sleep()
