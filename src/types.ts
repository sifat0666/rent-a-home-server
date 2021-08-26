import { Response, Request } from "express";
import { Redis } from "ioredis";
import { createUpvoteLoader } from "./utils/createUpvorteLoader";
import { createUserLoader } from "./utils/CreatorLoader";

export type MyContext = {
    req: Request & {session: any} ,
    res : Response,
    redis: Redis,
    userLoader: ReturnType<typeof createUserLoader>,
    upvoteLoader: ReturnType<typeof createUpvoteLoader>
}