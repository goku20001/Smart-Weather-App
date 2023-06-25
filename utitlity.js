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
let lat = ""
let lon = ""
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

const pushNotification = async (context, title, message) => {
  if(title === "Inclement Weather Alert!"){
    notificationCnt++;
  }
    
  const data = {
    type: "ALERT",
    locationId: context.locationId,
    title: title,
    message: message,
    deepLink: {
      type: "location",
      id: "notification origin"
    }
  }
  await context.api.notifications.create(data)
  await client.messages
        .create({
          body: `${title}\n${message}`,
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
    let title = "Inclement Weather Alert!"
    let message = "Windows are open in : ";
    for(let roomName of rooms){
      message += roomName + " ";
    }
    pushNotification(context, title, message);
  }
  else{
    notificationCnt = 0; 
  }
}

// Extract latitude and longitude from city name
const setLatLon = async () => {
  const config1 = {
    params: {
        q: `${city},in`,
        APPID: weatherApiKey
    }
  };


  // Convert city name to latitude/longitude
  const geocodingResponse = await axios.get(geocodingUrl, config1).catch(error => console.log(error));
  const geocodingData = geocodingResponse.data;

  lat = geocodingData[0].lat
  lon = geocodingData[0].lon
}

// Check weather conditiions using openweathermap API
const checkWeather = async context => {
  const currentWeatherUrl = `${weatherUrl}/weather`;
  const forecastUrl = `${weatherUrl}/forecast`;


  const config = {
    params: {
      lat: lat,
      lon: lon,
      APPID: weatherApiKey,
      unit: "metric"
    }
  }

  const response1 = await axios.get(currentWeatherUrl, config).catch(error => console.log(error));
  const response2 = await axios.get(forecastUrl, config).catch(error => console.log(error));

  const currentWeather = response1.data;
  const forecastWeather = response2.data;

  const currentWeatherId = currentWeather.weather[0].id
  const forecastWeatherId = forecastWeather.list[0].weather[0].id

  let thunderStorm = currentWeatherId.startsWith("2");
  let badAtmosphere = currentWeatherId.startsWith("7");
  let heavySnowOrRain = ["502","503","504","522","602","622"].includes(currentWeatherId);
  let windSpeed = currentWeather.wind.speed;

  const inclementCurrentWeather = thunderStorm || badAtmosphere || heavySnowOrRain || windSpeed > 15;

  thunderStorm = forecastWeatherId.startsWith("2");
  badAtmosphere = forecastWeatherId.startsWith("7");
  heavySnowOrRain = ["502","503","504","522","602","622"].includes(forecastWeatherId);
  windSpeed = forecastWeather.list[0].wind.speed;

  const inclementForecastWeather = thunderStorm || badAtmosphere || heavySnowOrRain || windSpeed > 15;

  if(inclementCurrentWeather){
    checkWindow(context);
    await context.api.schedules.schedule('windowHandler', '0/02 * * * ? *')
  }
  else{
    await context.api.schedules.delete('windowHandler')
    if(inclementForecastWeather){
      const title = "Inclement Weather Forecast!"
      const message = "It is likely going to be a bad weather. Be Ready!"
      await pushNotification(context, title, message);
    }
  }
}

// Check current pollution level(AQI)
const checkPollution = async (context) => {
  const pollutionUrl = 'http://api.openweathermap.org/data/2.5/air_pollution'
  const config = {
    params: {
      lat: lat,
      lon: lon,
      APPID: weatherApiKey,
      unit: "metric"
    }
  }

  const response = await axios.get(pollutionUrl, config).catch(error => console.log(error));
  const data = response.data;
  const aqi = data.list[0].main.aqi;

  const title = `Air Quality Index is: ${aqi}`
  let message = "";

  if(aqi === 1) message = "Perfect for a morning walk!"
  else if(aqi === 2) message = "Good for a morning walk!"
  else if(aqi === 3) message = "Try to wear a mask if you are sensitive!"
  else if(aqi === 4) message = "Please wear mask before going out!"
  else message = "Try to stay indoors if possible!"

  await pushNotification(context, title, message)
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
    setLatLon,
    checkPollution,
    notificationCnt,
    city,
    phoneNumber,
    multiPurposeSensors
}