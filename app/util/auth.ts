import SpotifyProvider from "next-auth/providers/spotify"
import fetch from 'node-fetch';
import {getServerSession, NextAuthOptions} from "next-auth";

const scopes = [
    "user-read-private",
    "user-read-email",
    "user-read-currently-playing"
].join(",");

const params = {
    scopes: scopes
}
const LOGIN_URL = `https://accounts.spotify.com/authorize?${new URLSearchParams(params).toString()}`;

async function refreshAccessToken(token : string)
{
    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", token.refreshToken);
    const response = await fetch('https://accounts.spotify.com/api/token',
        {
            method: "POST",
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + (new Buffer.from(process.env.SPOTIFY_ID + ':' + process.env.SPOTIFY_SECRET).toString('base64'))
            },
            body: params
        })
    const data = await response.json();
    return {
        accessToken: data["access_token"],
        refreshToken: data["refresh_token"] ?? token.refreshToken,
        accessTokenExpires: Date.now() + data["expires_in"] * 1000
    }
}
const authOptions : NextAuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_ID ?? '',
            clientSecret: process.env.SPOTIFY_SECRET ?? '',
            authorization: LOGIN_URL,
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/login"
    },
    callbacks: {
        async jwt({ token, account, profile }) {
            // Persist the OAuth access_token and or the user id to the token right after signin
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
                token.accessTokenExpires = account.expires_in
                if(profile)
                    token.id = profile.id

                return token
            }

            if(Date.now() < token.accessTokenExpires * 1000)
                return token

            return refreshAccessToken(token)
        },
        async session({session, token, user}){
            session.accessToken = token.accessToken;
            return session
        }
    }
}
function auth() {
    return getServerSession(authOptions);
}

export {authOptions, auth};