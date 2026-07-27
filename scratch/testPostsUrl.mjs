import axios from 'axios';

async function testPostsUrl() {
  const urls = [
    'https://www.youtube.com/@techvaseegrah/posts',
    'https://www.youtube.com/@techvaseegrah',
    'https://www.youtube.com/channel/UCdpaYm53cdH0SODoBXAKRmQ/posts'
  ];

  for (const url of urls) {
    console.log('\n--- Fetching:', url, '---');
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      const html = response.data;
      const match = html.match(/var ytInitialData = ({.*?});/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
      if (!match) {
        console.log('No ytInitialData');
        continue;
      }
      const json = JSON.parse(match[1]);
      const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
      console.log('Tabs count:', tabs.length);
      tabs.forEach((t, i) => {
        const title = t.tabRenderer?.title;
        const selected = t.tabRenderer?.selected;
        console.log(` Tab ${i + 1}: title="${title}" | selected=${selected}`);
      });
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

testPostsUrl().catch(console.error);
