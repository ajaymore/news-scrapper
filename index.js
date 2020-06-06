require('dotenv').config();
const fetch = require('isomorphic-fetch');
const cheerio = require('cheerio');
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

async function getHackerNews() {
  try {
    log('HackerNews Fetch Started!');
    const res = await fetch('https://news.ycombinator.com/');
    const html = await res.text();
    const $ = cheerio.load(html);
    const nodes = $('.athing');

    const news = nodes
      .map((i, el) => {
        const link = $(el).find('a.storylink').attr('href');
        return {
          title: $(el).find('a.storylink').text(),
          link: link.includes('http')
            ? link
            : `https://news.ycombinator.com/${link}`,
          age: $(el).next().find('.age a')
            ? $(el).next().find('.age a').text()
            : '',
          score: $(el).next().find('.score')
            ? $(el).next().find('.score').text()
            : '',
        };
      })
      .get();

    return dbRef
      .set(
        {
          hackerNews: news,
        },
        { merge: true }
      )
      .then(() => log('Hackernews Fetch successful!'));
  } catch (err) {
    if (err) log('HackerNews Fetch Error');
    return null;
  }
}

async function getLoksattaNews() {
  try {
    log('Loksatta Fetch Started!');
    const res = await fetch(`https://www.loksatta.com/sampadkiya/`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const node = $('div.topnews.topn2')[0];
    const singleItem = {
      banner: $(node).find('img').attr('src'),
      title: $(node).find('a').text(),
      link: $(node).find('a').attr('href'),
      excerpt: $(node).find('p').text(),
    };

    const nodes = $('div.toprelative.topr2 li');
    const items = nodes
      .map((i, el) => {
        const banner = $(el).find('img').attr('src');
        const title = $(el).find('a').text();
        const link = $(el).find('a').attr('href');
        const excerpt = '';
        return {
          banner,
          title,
          link,
          excerpt,
        };
      })
      .get();

    let news = [singleItem, ...items];

    const promises = news.map(async (item) => {
      try {
        log(`Fetching ${item.link}`);
        const res2 = await fetch(item.link);
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        return {
          ...item,
          author: $2('.dateholder').find('a').text() || '',
          content: $2('.txtsection').text() || '',
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);

    return dbRef
      .set(
        {
          loksattaNews: news,
        },
        { merge: true }
      )
      .then(() => log('Loksatta Fetch Complete!'));
  } catch (err) {
    if (err) log('Loksatta Fetch Error!');
    return null;
  }
}

async function getTheHinduNews() {
  try {
    log('The Hindu Fetch Started!');
    const res = await fetch(`https://www.thehindu.com/opinion/`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const items = $('div.ES2-100x4-text1')
      .map((i, el) => {
        const banner = '';
        const title = $(el).find('a').text();
        const link = $(el).find('a').attr('href');
        const excerpt = $(el).find('.ES2-100x4-text1-content').text();
        return {
          banner,
          title,
          link,
          excerpt,
        };
      })
      .get();

    const opinions = $('#section_1 div.story-card-33')
      .map((i, el) => {
        const banner = $(el).find('img').attr('src');
        const title = $(el).find('.story-card-33-heading a').text();
        const link = $(el).find('.story-card-33-heading a').attr('href');
        const excerpt = $(el).find('.story-card-33-text').text();
        const author = $(el).find('h3').next().text();
        return {
          banner,
          title,
          link,
          excerpt,
          author,
        };
      })
      .get();

    let news = items.concat(opinions);

    const promises = news.map(async (item) => {
      try {
        log(`Fetching ${item.link}`);
        const res2 = await fetch(item.link);
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        return {
          ...item,
          content: $2('.intro').next().text() || '',
          author: item.author || '',
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);

    return dbRef
      .set(
        {
          theHinduNews: news,
        },
        { merge: true }
      )
      .then(() => log('The Hindu Fetch Complete!'));
  } catch (err) {
    if (err) log('The Hindu Fetch Error!');
    return null;
  }
}

async function getIndiannExpressNews() {
  try {
    log('Indian Express Fetch Started!');
    const res = await fetch(`https://indianexpress.com/section/opinion/`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const node = $('.leadstory')[0];
    const singleItem = {
      banner: $(node).find('img').attr('src'),
      title: $(node).find('h2').text(),
      link: $(node).find('a').attr('href'),
      excerpt: '',
    };

    const nodes = $('.opi-story');
    const items = nodes
      .map((i, el) => {
        const banner = $(el).find('img').attr('src');
        const title = $(el).find('h2').text();
        const link = $(el).find('a').attr('href');
        const excerpt = '';
        const author = $(el).find('.title').text();
        return {
          banner,
          title,
          link,
          excerpt,
          author,
        };
      })
      .get()
      .filter((item, i) => i < 4);

    let news = [singleItem, ...items];

    const promises = news.map(async (item) => {
      try {
        log(`Fetching ${item.link}`);
        const res2 = await fetch(item.link);
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        return {
          ...item,
          content: $2('.full-details p').text() || '',
          author: item.author || '',
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);

    return dbRef
      .set(
        {
          indianExpressNews: news,
        },
        { merge: true }
      )
      .then(() => log('Indian Express Fetch Complete!'));
  } catch (err) {
    if (err) log('Indian Express Fetch Error!');
    return null;
  }
}

async function getMaharashtratimesNews() {
  try {
    log('Maharashtra times Fetch Started!');
    const res = await fetch(
      `https://maharashtratimes.com/edit/editorial/articlelist/2429054.cms`
    );
    const html = await res.text();
    const $ = cheerio.load(html);
    const nodes = $('.news-card.lead.col.news');
    let news = [];
    nodes.each((i, el) => {
      if (news.length > 4 || $(el).hasClass('con_ads')) {
        return;
      }
      const banner = $(el).find('img').attr('src');
      const title = $(el).find('.con_wrap').text();
      const link = $(el).find('a').attr('href');
      const excerpt = '';
      const author = '';
      news.push({
        banner,
        title,
        link,
        excerpt,
        author,
      });
    });

    const promises = news.map(async (item) => {
      try {
        log(`Fetching ${item.link}`);
        const res2 = await fetch(item.link);
        const html2 = await res2.text();
        const $2 = cheerio.load(html2);
        return {
          ...item,
          content: $2('.story-content').text() || '',
          author: item.author || '',
        };
      } catch (err) {
        log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);

    return dbRef
      .set(
        {
          maharashtratimesNews: news,
        },
        { merge: true }
      )
      .then(() => log('Maharashtra times Fetch Complete!'));
  } catch (err) {
    if (err) log('Maharashtra times Fetch Error!');
    return null;
  }
}

(async () => {
  console.time('startScrape');
  await getHackerNews();
  await getLoksattaNews();
  await getTheHinduNews();
  await getIndiannExpressNews();
  await getMaharashtratimesNews();
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
