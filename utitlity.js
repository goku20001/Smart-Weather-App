require('dotenv').config();
const weatherUrl = 'https://api.openweathermap.org/data/2.5';
const geocodingUrl = "http://api.openweathermap.org/geo/1.0/direct"
const weatherApiKey = process.env.WEATHER_API_KEY;
const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const axios = require('axios').default;
const client = require('twilio')(accountSid, authToken);


let notificationCnt = 0;
let phoneNumber = ""
let city = ""
const multiPurposeSensors = []


const setNotificationCnt = cnt => {
    notificationCnt = cnt;
}

const setPhoneNumber = number => {
    phoneNumber = number;
}

const setCity = cityName => {
    city = cityName;
}

const clearArray = arr => {
    arr.length = 0;
}


// Extract the multisensors/contact sensors
const getDevices = async context => {
  const data = await context.api.devices.listAll()
  for(let item of data){
    if(item.name === "VirtualSTS Multisensor Firmware"){
      multiPurposeSensors.push({deviceId: item.deviceId, roomId: item.roomId})
    }
  }
}

const ringPhoneNumber = async context => {
  await client.calls
        .create({
          twiml: '<Response><Say>Please Close All Your Windows!</Say></Response>',
          to: phoneNumber,
          from: '+14065057634'
        })
}

const pushNotification = async (context, rooms) => {
  notificationCnt++;
  let message = "Windows are open in : ";
  for(let roomName of rooms){
    message += roomName + " ";
  }
  const data = {
    type: "ALERT",
    locationId: context.locationId,
    title: "Inclement Weather!",
    message: message,
    deepLink: {
      type: "location",
      id: "notification origin"
    }
  }
  await context.api.notifications.create(data)
  await client.messages
        .create({
          body: `Inclement Weather Condition!\n${message}`,
          from: '+14065057634',
          to: phoneNumber
        })
  if(notificationCnt > 3){
    ringPhoneNumber(context)
  }
  console.log("Notification Sent".yellow);

}

// Check if windows are open or closed using the contact sensor
const checkWindow = async context => {

  let open = false;

  const rooms = []

  for(let {deviceId, roomId} of multiPurposeSensors){
    const data = await context.api.devices.getStatus(deviceId)
    const windowStatus = data.components.main.contactSensor.contact.value;
    if(windowStatus === "closed"){
      open = true;
      const roomData = await context.api.rooms.get(roomId);
      rooms.push(roomData.name)
    }
  }


  if(open){
    pushNotification(context, rooms);
  }
  else{
    notificationCnt = 0; 
  }
}

// Check weather conditiions using openweathermap API
const checkWeather = async context => {
  const currentWeatherUrl = `${weatherUrl}/weather`;
  const forecastUrl = `${weatherUrl}/forecast`;

  const config1 = {
      params: {
          q: `${city},in`,
          APPID: weatherApiKey
      }
  };


  // Convert city name to latitude/longitude
  const geocodingResponse = await axios.get(geocodingUrl, config1).catch(error => console.log(error));
  const geocodingData = geocodingResponse.data;

  const config2 = {
    params: {
      lat: geocodingData[0].lat,
      lon: geocodingData[0].lon,
      APPID: weatherApiKey,
      unit: "metric"
    }
  }

  const response1 = await axios.get(currentWeatherUrl, config2).catch(error => console.log(error));
  const response2 = await axios.get(forecastUrl, config2).catch(error => console.log(error));

  const currentWeather = response1.data;
  const forecastWeather = response2.data;

  const currentWeatherId = currentWeather.weather[0].id

  const thunderStorm = currentWeatherId.startsWith("2");
  const badAtmosphere = currentWeatherId.startsWith("7");
  const heavySnowOrRain = ["502","503","504","522","602","622"].includes(currentWeatherId);
  const windSpeed = currentWeather.wind.speed;

  const inclementWeather = thunderStorm || badAtmosphere || heavySnowOrRain || windSpeed > 15;

  if(inclementWeather){
    checkWindow(context);
    await context.api.schedules.schedule('windowHandler', '0/02 * * * ? *')
  }
  else{
    await context.api.schedules.delete('windowHandler')
  }
}

module.exports = {
    getDevices,
    ringPhoneNumber,
    pushNotification,
    checkWeather,
    checkWindow,
    setCity,
    setNotificationCnt,
    setPhoneNumber,
    clearArray,
    notificationCnt,
    city,
    phoneNumber,
    multiPurposeSensors
}