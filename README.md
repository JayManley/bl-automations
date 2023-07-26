1. Open bl-automations folder in command line or code editor terminal
2. Run **npm install** to install dependencies
3. Create a **config.js** file in bl-automations folder
4. Add config variables to **config.js** using export default, e.g:

```
export default {
   X2CAPTCHA_API_KEY: "",
   NEWRELIC: "",
   PHP_SESSION_ID: "",
   X_NEWRELIC_ID: "",
   LOG_TIME_ELAPSED: false,
   COMMIT_CRIMES: true,
   COMMIT_GTA: true,
   CRIME_ID: 8
}
```

5. Run **npm start** to start to application
