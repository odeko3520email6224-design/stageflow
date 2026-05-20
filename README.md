**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Run locally against real Base44 data**

Create `.env.local` from `.env.example`:

```
VITE_BASE44_APP_ID=6a04d375dd2d16805b295b5a
VITE_BASE44_APP_BASE_URL=https://stage-flow-map.base44.app
BASE44_API_KEY=your_local_base44_api_key
```

`BASE44_API_KEY` is optional, but useful for local write testing. Keep it server-side only: do not rename it to `VITE_BASE44_API_KEY`.

Then start the app:

```
npm run dev
```

Open the local URL. If login is required, use the app's login button or open the local URL with an `access_token` query parameter issued by Base44:

```
http://127.0.0.1:5173/?access_token=YOUR_BASE44_ACCESS_TOKEN
```

Do not commit `.env.local` or access tokens. They are ignored by git.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
