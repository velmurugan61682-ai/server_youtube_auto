import axios from 'axios';
import fs from 'fs';

async function debugHtml() {
  const url = 'https://www.youtube.com/channel/UCdpaYm53cdH0SODoBXAKRmQ/community';
  console.log('Fetching:', url);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const html = response.data;
  const match = html.match(/var ytInitialData = ({.*?});/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
  if (!match) {
    console.log('ytInitialData NOT found!');
    return;
  }

  const json = JSON.parse(match[1]);
  const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  console.log('Tabs found in ytInitialData:');
  tabs.forEach((t, i) => {
    const title = t.tabRenderer?.title;
    const selected = t.tabRenderer?.selected;
    const endpoint = t.tabRenderer?.endpoint?.browseEndpoint?.params;
    console.log(` Tab ${i + 1}: title="${title}" | selected=${selected} | params=${endpoint}`);
  });

  const communityTab = tabs.find(t =>
    t.tabRenderer?.title === 'Community' ||
    t.tabRenderer?.title === 'Posts' ||
    t.tabRenderer?.endpoint?.browseEndpoint?.params === 'Egljb21tdW5pdHk%3D' ||
    t.tabRenderer?.selected
  );

  if (communityTab) {
    console.log('\nCommunity Tab structure found!');
    const contents = communityTab.tabRenderer?.content?.sectionListRenderer?.contents || [];
    console.log('Section List contents length:', contents.length);
    if (contents.length > 0) {
      const itemSectionContents = contents[0]?.itemSectionRenderer?.contents || [];
      console.log('itemSectionRenderer contents length:', itemSectionContents.length);
      itemSectionContents.slice(0, 5).forEach((item, idx) => {
        console.log(` Item ${idx + 1} keys:`, Object.keys(item));
      });
    }
  }
}

debugHtml().catch(console.error);
