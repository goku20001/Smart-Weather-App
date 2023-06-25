require('dotenv').config();
const SmartApp = require('@smartthings/smartapp');
const {checkWeather, checkWindow, getDevices, setNotificationCnt, setPhoneNumber, setCity, clearArray, checkPollution, setLatLon, multiPurposeSensors} = require('./utitlity')


let notifyAQI = ""


/* Define the SmartApp */
const smartApp = new SmartApp()
  .configureI18n({updateFiles: true})
  .enableEventLogging(2)
  .appId("my-app-id")
  .permissions([
    "r:devices:*",
    "r:locations:*",
    "x:devices:*"
  ])
  .page('mainPage', (context, page, configData) => {

    page.section('userDetails', section => {
      section
        .numberSetting('phoneNumber')
        .required(true)
      section
        .textSetting('city')
        .required(true)
      section
        .booleanSetting('notify')
        .required(true)
    })
    
  })
  .updated(async (context, updateData) => {
    // Updated defines what code to run when the SmartApp is installed or the settings are updated by the user.

    // Clear any existing configuration.
    await context.api.schedules.delete()
    await context.api.subscriptions.delete();

    console.log('I am inside updated lifecycle event'.yellow);

    setPhoneNumber(`+91${context.config.phoneNumber[0].stringConfig.value}`)
    setCity(context.config.city[0].stringConfig.value)
    setNotificationCnt(0)
    clearArray(multiPurposeSensors)
    notifyAQI = context.config.notify[0].stringConfig.value;

    await getDevices(context);

    await context.api.schedules.schedule('weatherHandler', "0/30 * * * ? *")

    await setLatLon();

    if(notifyAQI === "true"){
      await context.api.schedules.schedule('pollutionHandler', '00 08 * * ? *', 'Asia/Kolkata');
    }
    
  })


  // Check weather every 30 minutes
  .scheduledEventHandler('weatherHandler', async (context, event) => {
    await checkWeather(context);
  })

  // Check Window(open/closed) every 2 minutes In case of an inclement weather
  .scheduledEventHandler('windowHandler', async (context, event) => {
    await checkWindow(context);
  })

  //Check AQI every morning at 08:00 AM and notify user
  .scheduledEventHandler('pollutionHandler', async (context, event) => {
    await checkPollution(context);
  })

  .scheduledEventHandler('test', async (context, event) => {
    checkWindow(context);
  })

  .uninstalled(async context => {
    console.log("Smart App Uninstalled!".yellow);
  })


  module.exports = {
    smartApp
  }