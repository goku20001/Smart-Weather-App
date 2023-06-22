require('dotenv').config();
const SmartApp = require('@smartthings/smartapp');
const {checkWeather, checkWindow, pushNotification, getDevices, setNotificationCnt, setPhoneNumber, setCity, clearArray, multiPurposeSensors} = require('./utitlity')



/* Define the SmartApp */
const smartApp = new SmartApp()
  .configureI18n({updateFiles: true}) // Enable translations and update translation file when new items are added.
  .enableEventLogging(2) // Logging for testing.
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

    await getDevices(context);

    const cronExpr = "0/30 * * * ? *";

    await context.api.schedules.schedule('weatherHandler', cronExpr)
    await checkWeather(context);

    // await context.api.schedules.schedule('test', '0/01 * * * ? *');
    
  })


  // Check weather every 30 minutes
  .scheduledEventHandler('weatherHandler', async (context, event) => {
    await checkWeather(context);
  })

  // Check Window(open/closed) every 2 minutes In case of an inclement weather
  .scheduledEventHandler('windowHandler', async (context, event) => {
    await checkWindow(context);
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