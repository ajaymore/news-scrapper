```
heroku login
cd my-project/
git init
heroku git:remote -a my-daily-news-scraper
heroku buildpacks:add jontewks/puppeteer
git add .
git commit -am "make it better"
git push heroku master
```

```
Create a NodeJS Script
Schedule the script every 8 hours with crontab -> Email the logfile & Send a Push notification
```

```
Pull in the news from Firestore and display
HackerNews opens in WebView
Newyourker opens in WebView
```
