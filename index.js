const puppeteer = require('puppeteer');
const chalk = require('chalk');
const admin = require('firebase-admin');
const { format } = require('date-fns');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://utilities-38d5b.firebaseio.com',
});

// MY OCD of colorful console.logs for debugging... IT HELPS
const error = chalk.bold.red;
const success = chalk.keyword('green');
const today = format(new Date(), 'dd-MM-yyyy');

const dbRef = admin.firestore().collection('news-feed').doc(today);

async function getHackerNews() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    console.log(success('HackerNews Fetch Started!'));
    await page.goto(`https://news.ycombinator.com/`);
    await page.waitForSelector('a.storylink');
    const hackerNews = await page.evaluate(() => {
      const titleNodeList = document.querySelectorAll(`a.storylink`);
      const ageList = document.querySelectorAll(`span.age`);
      const scoreList = document.querySelectorAll(`span.score`);
      const titleLinkArray = [];
      for (let i = 0; i < titleNodeList.length; i += 1) {
        const link = titleNodeList[i].getAttribute('href');
        titleLinkArray[i] = {
          title: titleNodeList[i].innerText.trim(),
          link: link.includes('http')
            ? link
            : `https://news.ycombinator.com/${link}`,
          age: ageList[i].innerText.trim(),
          score: scoreList[i].innerText.trim(),
        };
      }
      return titleLinkArray;
    });
    console.log(success('HackerNews Fetch Complete!'));
    return dbRef.set(
      {
        hackerNews,
      },
      { merge: true }
    );

    // await fs.writeFile(
    //   'hackernews.json',
    //   JSON.stringify(hackerNews),
    //   async (err) => {
    //     if (err) console.log(error(err));
    //     await browser.close();
    //     console.log(success('HackerNews Fetch Complete!'));
    //   }
    // );
  } catch (err) {
    if (err) console.log(error(err));
    await browser.close();
    console.log(error('Browser Closed'));
    return null;
  }
}

async function getLoksattaNews() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    console.log(success('Loksatta Fetch Started!'));
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
        await page2.goto(item.link);
        console.log(success('Fetching', item.link));
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
        console.log(err);
        return { ...item, content: '', author: '' };
      }
    });

    loksattaNews = await Promise.all(promises);
    console.log(success('Loksatta Fetch Complete!'));
    return dbRef.set(
      {
        loksattaNews,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) console.log(error(err));
    await browser.close();
    console.log(error('Browser Closed'));
    return null;
  }
}

async function getTheHinduNews() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    console.log(success('The Hindu Fetch Started!'));
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
        await page2.goto(item.link);
        console.log(success('Fetching', item.link));
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
        console.log(err);
        return { ...item, content: '', author: '' };
      }
    });

    theHinduNews = await Promise.all(promises);
    console.log(success('The Hindu Fetch Complete!'));
    return dbRef.set(
      {
        theHinduNews,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) console.log(error(err));
    await browser.close();
    console.log(error('Browser Closed'));
    return null;
  }
}

async function getIndiannExpressNews() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    console.log(success('Indian Express Fetch Started!'));
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
        await page2.goto(item.link);
        console.log(success('Fetching', item.link));
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
        console.log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);
    console.log(success('Indian Express Fetch Complete!'));
    return dbRef.set(
      {
        indexExpressNews: news,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) console.log(error(err));
    await browser.close();
    console.log(error('Browser Closed'));
    return null;
  }
}

async function getMaharashtratimesNews() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();

    console.log(success('Maharashtra times Fetch Started!'));
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
        await page2.goto(item.link);
        console.log(success('Fetching', item.link));
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
        console.log(err);
        return { ...item, content: '', author: '' };
      }
    });

    news = await Promise.all(promises);
    console.log(success('Maharashtra times Fetch Complete!'));
    return dbRef.set(
      {
        maharashtratimesNews: news,
      },
      { merge: true }
    );
  } catch (err) {
    if (err) console.log(error(err));
    await browser.close();
    console.log(error('Browser Closed'));
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
  console.timeEnd('startScrape');
  process.exit();
})();
