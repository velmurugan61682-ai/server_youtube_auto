import { google } from 'googleapis';
import logger from '../utils/logger.mjs';

export const getYouTubeAuth = () => {
  const redirectUri = process.env.REDIRECT_URI?.trim();
  
  if (!redirectUri) {
    const error = 'CRITICAL: REDIRECT_URI is not defined in environment variables!';
    logger.error(error);
    throw new Error(error);
  }
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

export const getYouTubeClient = (tokens, onTokensRefreshed) => {
  const auth = getYouTubeAuth();
  auth.setCredentials(tokens);
  
  if (onTokensRefreshed) {
    auth.on('tokens', (newTokens) => {
      onTokensRefreshed(newTokens);
    });
  }
  
  return google.youtube({ version: 'v3', auth });
};

export const getYouTubeClientWithApiKey = (apiKey) => {
  return google.youtube({ version: 'v3', auth: apiKey });
};

export const fetchLatestComments = async (youtube, channelId, maxResults = 50, videoId = null) => {
  try {
    const params = {
      part: 'snippet,replies',
      maxResults,
      order: 'time'
    };

    if (videoId) {
      params.videoId = videoId;
    } else {
      params.allThreadsRelatedToChannelId = channelId;
    }

    logger.info(`[YOUTUBE API] Request: commentThreads.list with params: ${JSON.stringify(params)}`);
    const res = await youtube.commentThreads.list(params);
    logger.info(`[YOUTUBE API] Response: commentThreads.list succeeded with status ${res.status}. Found ${res.data.items?.length || 0} comment threads.`);

    let allComments = [];
    for (const item of (res.data.items || [])) {
      const topLevelComment = item.snippet.topLevelComment;
      allComments.push({
        youtubeId: topLevelComment.id,
        videoId: item.snippet.videoId,
        text: topLevelComment.snippet.textDisplay,
        author: topLevelComment.snippet.authorDisplayName,
        authorProfileImageUrl: topLevelComment.snippet.authorProfileImageUrl,
        publishedAt: topLevelComment.snippet.publishedAt,
        parentId: null
      });

      if (item.replies && item.replies.comments) {
        for (const reply of item.replies.comments) {
          allComments.push({
            youtubeId: reply.id,
            videoId: item.snippet.videoId,
            text: reply.snippet.textDisplay,
            author: reply.snippet.authorDisplayName,
            authorProfileImageUrl: reply.snippet.authorProfileImageUrl,
            publishedAt: reply.snippet.publishedAt,
            parentId: topLevelComment.id
          });
        }
      }
    }
    return allComments;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: commentThreads.list failed: ${errorMsg}`);
    return [];
  }
};

export const deleteCommentFromYouTube = async (youtube, commentId, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!commentId || typeof commentId !== 'string') {
        logger.error(`[YOUTUBE API] Invalid commentId provided to delete: ${commentId}`);
        return { success: false, reason: 'Invalid commentId format' };
      }

      logger.info(`[YOUTUBE API] Attempting permanent deletion (comments.delete) for comment ID: ${commentId} (Attempt ${attempt}/${retries})`);
      const response = await youtube.comments.delete({ id: commentId });
      logger.info(`[YOUTUBE API] Response: comments.delete succeeded with status ${response.status}. Comment ${commentId} permanently deleted.`);
      return { success: true, action: 'delete' };
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      const status = error.response?.status || 500;
      
      // Retry on 5xx server errors or 429 rate limits
      if ((status >= 500 || status === 429) && attempt < retries) {
        logger.warn(`[YOUTUBE API] Temporary error on comments.delete [ID: ${commentId}]: ${errorMsg}. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      logger.warn(`[YOUTUBE API] comments.delete failed/unauthorized: ${errorMsg}. Falling back to setModerationStatus(rejected)...`);
      
      // Fallback 1: Try setModerationStatus(rejected)
      try {
        logger.info(`[YOUTUBE API] Attempting rejection (setModerationStatus: rejected) for comment ID: ${commentId}`);
        const response = await youtube.comments.setModerationStatus({
          id: [commentId],
          moderationStatus: 'rejected'
        });
        logger.info(`[YOUTUBE API] Response: setModerationStatus(rejected) succeeded with status ${response.status}. Comment ${commentId} rejected.`);
        return { success: true, action: 'reject' };
      } catch (rejectError) {
        const rejectErrorMsg = rejectError.response?.data?.error?.message || rejectError.message;
        logger.warn(`[YOUTUBE API] setModerationStatus(rejected) failed/unauthorized: ${rejectErrorMsg}. Falling back to setModerationStatus(heldForReview)...`);
        
        // Fallback 2: Try setModerationStatus(heldForReview)
        try {
          logger.info(`[YOUTUBE API] Attempting hide/hold (setModerationStatus: heldForReview) for comment ID: ${commentId}`);
          const response = await youtube.comments.setModerationStatus({
            id: [commentId],
            moderationStatus: 'heldForReview'
          });
          logger.info(`[YOUTUBE API] Response: setModerationStatus(heldForReview) succeeded with status ${response.status}. Comment ${commentId} held for review.`);
          return { success: true, action: 'hide' };
        } catch (hideError) {
          const hideErrorMsg = hideError.response?.data?.error?.message || hideError.message;
          logger.error(`[YOUTUBE API] All moderation options failed for comment ${commentId}. Delete error: ${errorMsg} | Reject error: ${rejectErrorMsg} | Hide error: ${hideErrorMsg}`);
          return { 
            success: false, 
            reason: `Delete error: ${errorMsg} | Reject error: ${rejectErrorMsg} | Hide error: ${hideErrorMsg}` 
          };
        }
      }
    }
  }
};

export const likeComment = async (youtube, commentId) => {
  logger.info(`[YOUTUBE API] Like comment request received for ID: ${commentId}. Bypassing as YouTube API v3 does not support comment liking.`);
  return { success: false, reason: 'Comment liking is not supported by the YouTube Data API v3.', status: 'not_supported' };
};

export const hideComment = async (youtube, commentId) => {
  try {
    logger.info(`[YOUTUBE API] Request: setModerationStatus(heldForReview) for comment ID: ${commentId}`);
    const response = await youtube.comments.setModerationStatus({
      id: commentId,
      moderationStatus: 'heldForReview'
    });
    logger.info(`[YOUTUBE API] Response: setModerationStatus(heldForReview) succeeded with status ${response.status}. Comment ${commentId} hidden.`);
    return { success: true };
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: setModerationStatus(heldForReview) failed for comment ${commentId}: ${errorMsg}`);
    return { success: false, reason: errorMsg };
  }
};

export const replyToComment = async (youtube, parentId, text) => {
  try {
    logger.info(`[YOUTUBE API] Request: comments.insert under parent ID ${parentId} with content: "${text}"`);
    const response = await youtube.comments.insert({
      part: 'snippet',
      resource: {
        snippet: {
          parentId,
          textOriginal: text
        }
      }
    });
    logger.info(`[YOUTUBE API] Response: comments.insert succeeded with status ${response.status}. Replied to comment ${parentId}.`);
    return { success: true };
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: comments.insert failed under parent ${parentId}: ${errorMsg}`);
    return { success: false, reason: errorMsg };
  }
};

export const fetchVideos = async (youtube, channelId) => {
  try {
    logger.info(`[YOUTUBE API] Request: channels.list for channel ID: ${channelId}`);
    const channelRes = await youtube.channels.list({
      part: 'contentDetails',
      id: channelId
    });
    logger.info(`[YOUTUBE API] Response: channels.list succeeded for ${channelId} with status ${channelRes.status}`);

    const uploadsPlaylistId = channelRes.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      logger.warn(`[YOUTUBE API] No uploads playlist found for channel ID: ${channelId}`);
      return [];
    }

    logger.info(`[YOUTUBE API] Request: playlistItems.list for uploads playlist: ${uploadsPlaylistId}`);
    const playlistRes = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 50
    });
    logger.info(`[YOUTUBE API] Response: playlistItems.list succeeded with status ${playlistRes.status}. Found ${playlistRes.data.items?.length || 0} items.`);

    return (playlistRes.data.items || []).map(item => ({
      videoId: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt
    }));
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: fetchVideos failed for channel ${channelId}: ${errorMsg}`);
    return [];
  }
};

export const fetchAllVideos = async (youtube, channelId) => {
  try {
    logger.info(`[YOUTUBE API] Request: channels.list for full sync of channel ID: ${channelId}`);
    const channelRes = await youtube.channels.list({
      part: 'contentDetails',
      id: channelId
    });
    logger.info(`[YOUTUBE API] Response: channels.list succeeded for ${channelId} with status ${channelRes.status}`);

    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      logger.warn(`[YOUTUBE API] No uploads playlist found for channel ${channelId}`);
      return [];
    }

    let allVideos = [];
    let nextPageToken = null;

    do {
      logger.info(`[YOUTUBE API] Request: playlistItems.list for uploads playlist: ${uploadsPlaylistId} (Token: ${nextPageToken || 'first page'})`);
      const playlistRes = await youtube.playlistItems.list({
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: 50,
        pageToken: nextPageToken || undefined
      });
      logger.info(`[YOUTUBE API] Response: playlistItems.list page succeeded with status ${playlistRes.status}. Retrieved ${playlistRes.data.items?.length || 0} items.`);

      const items = (playlistRes.data.items || []).map(item => ({
        videoId: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        publishedAt: item.snippet.publishedAt
      }));

      allVideos = allVideos.concat(items);
      nextPageToken = playlistRes.data.nextPageToken;
    } while (nextPageToken);

    logger.info(`[YOUTUBE API] Completed fetching all videos for channel ${channelId}. Total: ${allVideos.length} videos.`);
    return allVideos;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: fetchAllVideos failed for channel ${channelId}: ${errorMsg}`);
    return [];
  }
};

export const fetchAllCommentsAndRepliesForVideo = async (youtube, videoId) => {
  try {
    let allComments = [];
    let nextPageToken = null;

    do {
      logger.info(`[YOUTUBE API] Request: commentThreads.list for video ID: ${videoId} (Token: ${nextPageToken || 'first page'})`);
      const res = await youtube.commentThreads.list({
        part: 'snippet,replies',
        videoId: videoId,
        maxResults: 100,
        pageToken: nextPageToken || undefined
      });
      logger.info(`[YOUTUBE API] Response: commentThreads.list page succeeded with status ${res.status}. Retrieved ${res.data.items?.length || 0} threads.`);

      for (const item of (res.data.items || [])) {
        const topLevelComment = item.snippet.topLevelComment;
        
        allComments.push({
          youtubeId: topLevelComment.id,
          videoId: videoId,
          text: topLevelComment.snippet.textDisplay,
          author: topLevelComment.snippet.authorDisplayName,
          authorProfileImageUrl: topLevelComment.snippet.authorProfileImageUrl,
          publishedAt: topLevelComment.snippet.publishedAt,
          parentId: null
        });

        if (item.replies && item.replies.comments) {
          for (const reply of item.replies.comments) {
            allComments.push({
              youtubeId: reply.id,
              videoId: videoId,
              text: reply.snippet.textDisplay,
              author: reply.snippet.authorDisplayName,
              authorProfileImageUrl: reply.snippet.authorProfileImageUrl,
              publishedAt: reply.snippet.publishedAt,
              parentId: topLevelComment.id
            });
          }
        }
      }

      nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);

    logger.info(`[YOUTUBE API] Completed fetching all comments for video ${videoId}. Total: ${allComments.length} comments.`);
    return allComments;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    if (errorMsg.includes('disabled comments') || errorMsg.includes('commentsDisabled')) {
      logger.warn(`[YOUTUBE API] Comments are disabled for video ${videoId}. Skipping comments fetch.`);
    } else {
      logger.error(`[YOUTUBE API] Error: fetchAllCommentsAndRepliesForVideo failed for video ${videoId}: ${errorMsg}`);
    }
    return [];
  }
};

export const fetchPlaylists = async (youtube, channelId) => {
  try {
    let allPlaylists = [];
    let nextPageToken = null;
    do {
      logger.info(`[YOUTUBE API] Request: playlists.list for channel ID: ${channelId} (Token: ${nextPageToken || 'first page'})`);
      const res = await youtube.playlists.list({
        part: 'snippet,contentDetails',
        channelId,
        maxResults: 50,
        pageToken: nextPageToken || undefined
      });
      logger.info(`[YOUTUBE API] Response: playlists.list page succeeded with status ${res.status}. Retrieved ${res.data.items?.length || 0} playlists.`);
      
      const items = (res.data.items || []).map(item => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt
      }));
      allPlaylists = allPlaylists.concat(items);
      nextPageToken = res.data.nextPageToken;
    } while (nextPageToken);
    return allPlaylists;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    logger.error(`[YOUTUBE API] Error: fetchPlaylists failed for channel ${channelId}: ${errorMsg}`);
    return [];
  }
};
