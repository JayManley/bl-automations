module.exports = (NEWRELIC, X_NEWRELIC_ID, PHP_SESSION_ID) => {
    return {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "newrelic": NEWRELIC,
        "sec-ch-ua": "\"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"114\", \"Google Chrome\";v=\"114\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "traceparent": "00-e9dd23c45a8fd9f7a16a83794a07dc00-26e3b4420235f156-01",
        "tracestate": "3519484@nr=0-1-3519484-1385962235-26e3b4420235f156----1688591917116",
        "x-newrelic-id": X_NEWRELIC_ID,
        "x-requested-with": "XMLHttpRequest",
        "cookie": `PHPSESSID=${PHP_SESSION_ID}; __utmz=250505365.1684691959.19.2.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); __utma=250505365.1577129376.1612531537.1684691959.1688551579.20; __utmc=250505365; _ga=GA1.2.1577129376.1612531537; _gid=GA1.2.689581731.1688551579; _vid_t=3qK6SQ3cMsXdpD/QUpiJetTp1Tiug1lTtOq3jn8wSepi77bAU1NDYAlj7EfTGAN9sqgTC7zhqdHgFw==; _ga_BYR41JF2ZS=GS1.1.1688551578.2.0.1688551581.0.0.0`,
        "Referer": "https://www.bootleggers.us/crimes.php",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }
}