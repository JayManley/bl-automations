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
   COMMIT_CRIMES: true,
   COMMIT_GTA: true,
   COMMIT_MASTERMIND_CRIMES: false, // Set to **true** if you are GF+ to commit Mastermind Crimes
   CRIME_ID: 9, // Change this to the ID of the crime you want to commit, Rob a mail truck = 8 for reference, the one you unlock at Godfather will be number 9
   CRIME_JAM_CHOICE: 'run', // You can change jam choices to either 'shoot', 'run' or 'surrender'
   GTA_JAM_CHOICE: 'shoot',
}
```

5. Run **npm start** to start to application
