require('dotenv').config();
const puppeteer = require('puppeteer');
const admin = require('firebase-admin');
const { format } = require('date-fns');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const serviceAccount = require('./serviceAccount.json');
const token = require('./token.json');
const credentials = require('./credentials.json');

if (fs.existsSync(path.resolve(__dirname, 'log.txt'))) {
  fs.unlinkSync(path.resolve(__dirname, 'log.txt'));
}
const logger = fs.createWriteStream('log.txt', {
  flags: 'a', // 'a' means appending (old data will be preserved)
});

const EMAIL_USERNAME = 'mail@ajaymore.in';
const COMMON_NAME = 'Ajay More';

const nodemailerSettings = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  from: `"${COMMON_NAME}" <${EMAIL_USERNAME}>`,
  auth: {
    type: 'OAuth2',
    user: EMAIL_USERNAME,
    clientId: credentials.installed.client_id,
    clientSecret: credentials.installed.client_secret,
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expires: token.expiry_date,
  },
};

const gmailTransport = nodemailer.createTransport(nodemailerSettings);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});

const today = format(new Date(), 'dd-MM-yyyy');

const dbRef = admin.firestore().collection('news-feed').doc(today);

const log = (message) => {
  console.log(message);
  logger.write(
    `${format(new Date(), 'dd-MM-yyyy hh:mm:ss aa')} : ${message} \n`
  );
};

async function getHackerNews(browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    log('HackerNews Fetch Started!');
    await page.goto(`https://news.ycombinator.com/`);
    await page.waitForSelector('tr.athing');
    const hackerNews = await page.evaluate(() => {
      const nodes = document.querySelectorAll('tr.athing');
      const titleLinkArray = [];
      nodes.forEach((node) => {
        const link = node.querySelector('a.storylink').getAttribute('href');
        titleLinkArray.push({
          title: node.querySelector('a.storylink').innerText,
          link: link.includes('http')
            ? link
            : `https://news.ycombinator.com/${link}`,
          age: node.nextElementSibling.querySelector('.age a')
            ? node.nextElementSibling.querySelector('.age a').innerText
            : '',
          score: node.nextElementSibling.querySelector('.score')
            ? node.nextElementSibling.querySelector('.score').innerText
            : '',
        });
      });
      return titleLinkArray;
    });
    log('HackerNews Fetch Complete!');
    return dbRef.set(
      {
        hackerNews,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) log(err);
    return null;
  }
}

async function getLoksattaNews(browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    log('Loksatta Fetch Started!');
    await page.goto(`https://www.loksatta.com/sampadkiya/`);
    await page.waitForSelector('div.topnews.topn2');
    let loksattaNews = await page.evaluate(() => {
      let news = [];
      const node = document.querySelector('div.topnews.topn2');
      const banner = node.querySelector('img').getAttribute('src');
      const title = node.querySelector('a').textContent;
      const link = node.querySelector('a').getAttribute('href');
      const excerpt = node.querySelector('p').textContent;
      news = news.concat({
        banner,
        title,
        link,
        excerpt,
      });
      const newsItems = document.querySelectorAll('div.toprelative.topr2 li');
      newsItems.forEach((linkNode) => {
        const banner2 = linkNode.querySelector('img').getAttribute('src');
        const title2 = linkNode.querySelector('a').textContent;
        const link2 = linkNode.querySelector('a').getAttribute('href');
        const excerpt2 = '';
        news = news.concat({
          banner: banner2,
          title: title2,
          link: link2,
          excerpt: excerpt2,
        });
      });
      return news;
    });

    const promises = loksattaNews.map(async (item) => {
      try {
        const page2 = await browser.newPage();
        await page2.setDefaultNavigationTimeout(60000);
        await page2.goto(item.link);
        log(`Fetching ${item.link}`);
        await page2.waitForSelector('.txtsection');
        const { author, content } = await page2.evaluate(() => {
          return {
            content: document.querySelector('.txtsection').textContent || '',
            author:
              document.querySelector('.dateholder').querySelector('a')
                .textContent || '',
          };
        });
        return {
          ...item,
          author,
          content,
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    loksattaNews = await Promise.all(promises);
    log('Loksatta Fetch Complete!');
    return dbRef.set(
      {
        loksattaNews,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) log(err);
    return null;
  }
}

async function getTheHinduNews(browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    log('The Hindu Fetch Started!');
    await page.goto(`https://www.thehindu.com/opinion/`);
    await page.waitForSelector('div.ES2-100x4-text1');
    let theHinduNews = [];
    const editorials = await page.evaluate(() => {
      let news = [];
      const newsItems = document.querySelectorAll('div.ES2-100x4-text1');
      newsItems.forEach((linkNode) => {
        const banner = '';
        const title = linkNode.querySelector('a').textContent;
        const link = linkNode.querySelector('a').getAttribute('href');
        const excerpt = linkNode.querySelector('.ES2-100x4-text1-content')
          .textContent;
        news = news.concat({
          banner,
          title,
          link,
          excerpt,
        });
      });

      const opinions = document
        .getElementById('section_1')
        .querySelectorAll('div.story-card-33');
      opinions.forEach((linkNode) => {
        const banner = linkNode.querySelector('img').getAttribute('src');
        const title = linkNode.querySelector('.story-card-33-heading a')
          .textContent;
        const link = linkNode
          .querySelector('.story-card-33-heading a')
          .getAttribute('href');
        const excerpt = linkNode.querySelector('.story-card-33-text')
          .textContent;
        const author = linkNode.querySelector('h3').nextElementSibling
          .textContent;
        news = news.concat({
          banner,
          title,
          link,
          excerpt,
          author,
        });
      });
      return news;
    });
    theHinduNews = theHinduNews.concat(editorials);

    const promises = theHinduNews.map(async (item) => {
      try {
        const page2 = await browser.newPage();
        await page2.setDefaultNavigationTimeout(60000);
        await page2.goto(item.link);
        log(`Fetching ${item.link}`);
        await page2.waitForSelector('.intro');
        const { author, content } = await page2.evaluate(() => {
          return {
            content:
              document.querySelector('.intro').nextElementSibling.textContent ||
              '',
            author: '',
          };
        });
        return {
          ...item,
          author: item.author || author,
          content,
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    theHinduNews = await Promise.all(promises);
    log('The Hindu Fetch Complete!');
    return dbRef.set(
      {
        theHinduNews,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) log(err);
    return null;
  }
}

async function getIndiannExpressNews(browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    log('Indian Express Fetch Started!');
    await page.goto(`https://indianexpress.com/section/opinion/`);
    await page.waitForSelector('.leadstory');
    let news = [];
    const editorials = await page.evaluate(() => {
      let newsItems = [];

      const getSingle = () => {
        const node = document.querySelector('.leadstory');
        const banner = node.querySelector('img').getAttribute('src');
        const title = node.querySelector('h2').textContent;
        const link = node.querySelector('a').getAttribute('href');
        const excerpt = '';
        newsItems = newsItems.concat({
          banner,
          title,
          link,
          excerpt,
        });
      };
      getSingle();

      const opinions = document.querySelectorAll('.opi-story');
      opinions.forEach((linkNode, index) => {
        if (index > 3) {
          return;
        }
        const banner = linkNode.querySelector('img').getAttribute('src');
        const title = linkNode.querySelector('h2').textContent;
        const link = linkNode.querySelector('a').getAttribute('href');
        const excerpt = '';
        const author = linkNode.querySelector('.title').textContent;
        newsItems = newsItems.concat({
          banner,
          title,
          link,
          excerpt,
          author,
        });
      });
      return newsItems;
    });
    news = news.concat(editorials);

    const promises = news.map(async (item) => {
      try {
        const page2 = await browser.newPage();
        await page2.setDefaultNavigationTimeout(60000);
        await page2.goto(item.link);
        log(`Fetching ${item.link}`);
        await page2.waitForSelector('.full-details');
        const { author, content } = await page2.evaluate(() => {
          const itemContent = [];
          document.querySelectorAll('.full-details p').forEach((node) => {
            itemContent.push(node.textContent);
          });
          return {
            content: itemContent.join('\n'),
            author: '',
          };
        });
        return {
          ...item,
          author: item.author || author,
          content,
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);
    log('Indian Express Fetch Complete!');
    return dbRef.set(
      {
        indianExpressNews: news,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) log(err);
    return null;
  }
}

async function getMaharashtratimesNews(browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    log('Maharashtra times Fetch Started!');
    await page.goto(
      `https://maharashtratimes.com/edit/editorial/articlelist/2429054.cms`
    );
    await page.waitForSelector('.news-card.lead.col.news');
    let news = [];
    const editorials = await page.evaluate(() => {
      let newsItems = [];

      const opinions = document.querySelectorAll('.news-card.lead.col.news');
      opinions.forEach((linkNode) => {
        if (newsItems.length > 4 || linkNode.classList.contains('con_ads')) {
          return;
        }
        const banner = linkNode.querySelector('img').getAttribute('src');
        const title = linkNode.querySelector('.con_wrap').textContent;
        const link = linkNode.querySelector('a').getAttribute('href');
        const excerpt = '';
        const author = '';
        newsItems = newsItems.concat({
          banner,
          title,
          link,
          excerpt,
          author,
        });
      });
      return newsItems;
    });
    news = news.concat(editorials);

    const promises = news.map(async (item) => {
      try {
        const page2 = await browser.newPage();
        await page2.setDefaultNavigationTimeout(60000);
        await page2.goto(item.link);
        log(`Fetching ${item.link}`);
        await page2.waitForSelector('.story-content');
        const { author, content } = await page2.evaluate(() => {
          return {
            content: document.querySelector('.story-content').textContent,
            author: '',
          };
        });
        return {
          ...item,
          author: item.author || author,
          content,
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);
    log('Maharashtra times Fetch Complete!');

    return dbRef.set(
      {
        maharashtratimesNews: news,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) log(err);
    return null;
  }
}

(async () => {
  console.time('startScrape');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  await getHackerNews(browser);
  await getLoksattaNews(browser);
  await getTheHinduNews(browser);
  await getIndiannExpressNews(browser);
  await getMaharashtratimesNews(browser);
  await browser.close();
  log('Browser closed');
  logger.end(async () => {
    await gmailTransport.sendMail({
      from: EMAIL_USERNAME,
      subject: 'News Scrape Status',
      html: '<h1>Report is attached.</h1>',
      to: 'mail@ajaymore.in',
      attachments: [{ path: path.resolve(__dirname, 'log.txt') }],
    });
    console.timeEnd('startScrape');
    process.exit();
  });
})();
