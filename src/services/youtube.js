const CLIENT_ID = '178752799662-cfvgsbbi16dgv3u84hetmg2u52oiqcfk.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/youtube'; // Full access required for delete

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Load the Google Identity Services script
export const loadGoogleScripts = (onGapiLoaded, onGisLoaded) => {
    // Load GAPI (for making API requests)
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
        window.gapi.load('client', async () => {
            await window.gapi.client.init({
                // apiKey: 'YOUR_API_KEY', // Optional if using OAuth 2.0 mainly
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest'],
            });
            gapiInited = true;
            if (gisInited) onGapiLoaded();
        });
    };
    document.body.appendChild(gapiScript);

    // Load GIS (for Authentication)
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        gisInited = true;
        onGisLoaded();
    };
    document.body.appendChild(gisScript);
};

// Initialize the Token Client (Login Button logic)
export const initTokenClient = (callback) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                throw (response);
            }
            callback(response.access_token);
        },
    });
};

// Trigger the login popup
export const handleLogin = () => {
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.error("Token client not initialized yet");
    }
};

// Fetch subscriptions recursively (handling pagination)
export const fetchSubscriptions = async (accessToken, pageToken = '', allSubs = []) => {
    try {
        const response = await window.gapi.client.youtube.subscriptions.list({
            part: 'snippet,contentDetails',
            mine: true,
            maxResults: 50,
            pageToken: pageToken,
            order: 'alphabetical'
        });

        const items = response.result.items.map(item => ({
            id: item.snippet.resourceId.channelId,
            subscriptionId: item.id, // Required for deletion
            name: item.snippet.title,
            handle: item.snippet.title, // YouTube API doesn't always give custom handle easily in this list, using Title for now
            sub_count: 'Unknown', // Requires separate channel lookup, keeping simple for now
            description: item.snippet.description,
            status: 'pending', // Default status for new imports
            avatar: item.snippet.thumbnails.default.url
        }));

        const newAllSubs = [...allSubs, ...items];

        if (response.result.nextPageToken) {
            return fetchSubscriptions(accessToken, response.result.nextPageToken, newAllSubs);
        }

        return newAllSubs;
    } catch (err) {
        console.error("Error fetching subs", err);
        throw err;
    }
};

// Unsubscribe from a channel
export const deleteSubscription = async (subscriptionId) => {
    if (!subscriptionId) throw new Error("No subscription ID provided");
    try {
        await window.gapi.client.youtube.subscriptions.delete({
            id: subscriptionId
        });
        return true;
    } catch (err) {
        console.error("Error deleting subscription:", err);
        throw err;
    }
};

// Subscribe to a channel
export const subscribeToChannel = async (channelId) => {
    try {
        const response = await window.gapi.client.youtube.subscriptions.insert({
            part: 'snippet',
            resource: {
                snippet: {
                    resourceId: {
                        kind: 'youtube#channel',
                        channelId: channelId
                    }
                }
            }
        });
        return response.result;
    } catch (err) {
        console.error("Error subscribing:", err);
        throw err;
    }
};
