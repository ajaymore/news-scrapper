#!/usr/bin/env sh
osascript -e 'display notification "Web scraping has started!" with title "Web Scraper"'
echo "Running node"
/Users/mystical/.nvm/versions/node/v12.16.1/bin/node index.js
echo "Running node complete"