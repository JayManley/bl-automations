1. Open bl-automations folder in command line or code editor terminal
2. Run **npm install** to install dependencies
3. Create a **.env** file in bl-automations folder
   -  Add environment variables to **.env**, e.g:
   -  X2CAPTCHA_API_KEY="XYZ123" (API key from 2Captcha Customer Account)
      NEWRELIC="123XYZ" (You can find this while playing BL if you complete any action, e.g. a crime and review the request headers in the network tab)
      PHP_SESSION_ID="PHP123" (As above)
      X_NEWRELIC_ID="XYZ321" (As above)
      LOG_TIME_ELAPSED=0 (0 = false, 1 = true. This just adds an extra log when enabled to show time elapsed between each crime)
4. Run **npm start** to start to application
