import "reflect-metadata";
import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/post";
import { HelloResolver } from "./resolvers/hello";
import { createConnection } from "typeorm";
import { UserResolver } from "./resolvers/user";

import connectRedis from 'connect-redis'
import Redis from 'ioredis';
import session from 'express-session';

import { __prod__ } from "./constants";
import { MyContext } from "./types";
import { createUserLoader } from "./utils/CreatorLoader";
import { createUpvoteLoader } from "./utils/createUpvorteLoader";
// import { Post } from "./entity/Post";






//rerun

(async () => {

    // sendEmail('sifat0666@gmail.com', 'hello')
    // const conn = await createConnection()
    await createConnection()

    // conn.runMigrations()

    // await Post.delete({})
    // await User.delete({})

    const app = express()

    app.use(cors({
      origin: 'http://localhost:3000',
      credentials: true
    }))

    

    const RedisStore = connectRedis(session)
    const redis = new Redis()

    app.use(
      session({
        name: 'qid',
        store: new RedisStore({ 
            client: redis,
            disableTouch: true
         }),
        cookie:{
            maxAge: 1000 * 60 * 60 * 24 * 365,
            httpOnly: true,
            secure: __prod__,
            sameSite: "lax"
        },
        saveUninitialized: false,
        secret: 'keyboard cat asdfawefadsfav vr w dadf',
        resave: false,
      })
    )


    const server = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolver, PostResolver, UserResolver],
            // validate: false,


        }),
        context: ({req, res}): MyContext => ({
          req, 
          res, 
          redis, 
          userLoader: createUserLoader(),
          upvoteLoader: createUpvoteLoader()
        })
    })


    server.applyMiddleware({ app, cors: false });

    app.listen(process.env.PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${process.env.PORT}${server.graphqlPath}`);
  });
})()



