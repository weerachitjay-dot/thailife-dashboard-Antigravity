export default async function handler(request, response) {
    const { gid, docId } = request.query;
    const targetDocId = docId || '1gCAb0yNmls8NHsTVtmpmOZQN3SpWF_V66zwnchJvGcc';

    if (!gid) {
        return response.status(400).json({ error: 'Missing gid parameter' });
    }

    const url = `https://docs.google.com/spreadsheets/d/${targetDocId}/export?format=csv&gid=${gid}`;

    try {
        const fetchResponse = await fetch(url);
        if (!fetchResponse.ok) {
            return response.status(fetchResponse.status).send('Failed to fetch sheet');
        }
        const csvText = await fetchResponse.text();

        // Set headers to allow simple fetching
        response.setHeader('Content-Type', 'text/csv');
        response.setHeader('Access-Control-Allow-Origin', '*');

        return response.status(200).send(csvText);
    } catch (error) {
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
