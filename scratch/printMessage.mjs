import axios from 'axios';

async function printMessage() {
  const url = 'https://www.youtube.com/channel/UCdpaYm53cdH0SODoBXAKRmQ/community';
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const html = response.data;
  const match = html.match(/var ytInitialData = ({.*?});/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
  const json = JSON.parse(match[1]);
  const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const selectedTab = tabs.find(t => t.tabRenderer?.selected);
  const msg = selectedTab?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.messageRenderer;
  console.log('Message:', JSON.stringify(msg, null, 2));
}

printMessage().catch(console.error);
