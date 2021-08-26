import { Post } from "./../entity/Post";
import { Arg, Ctx, Field, FieldResolver, InputType, Int, Mutation, ObjectType, Query, Resolver, Root, UseMiddleware } from "type-graphql";
import { MyContext } from "src/types";
import { isAuth } from "./../middleware/isAuth";
import { getConnection, getManager, ReadPreference } from "typeorm";
import { User } from "./../entity/User";
import { Upvote } from "./../entity/Upvote";






@InputType()
class PostInput{
    @Field()
    title: string

    @Field()
    text: string
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}



@Resolver(of => Post)
export class PostResolver{

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() {userLoader}: MyContext) {
    return userLoader.load(post.creatorId)
  }

  @FieldResolver(() => Int, {nullable: true})
  async voteStatus(@Root() post: Post, @Ctx() {upvoteLoader, req}: MyContext){

    if(!req.session.userId){
      return null
    }

    const upvote = await upvoteLoader.load({postId: post.id, userId: req.session.userId})

    return upvote ? upvote.value : null

  }


  @FieldResolver(()=>String)
  email(@Root() user: User, @Ctx() {req}: MyContext){
      if(req.session.userId === user.id){
          return user.email
      }

      return []
  }


    @Mutation(()=> Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg('postId', ()=>Int) postId: number,
        @Arg('value', ()=> Int) value: number,
        @Ctx() {req}: MyContext
    ){
        const {userId} = req.session
        const isUpvote = value !== -1
        const realValue = isUpvote ? 1 : -1

        const upvote = await Upvote.findOne({where:{postId, userId}})

        if (upvote && upvote.value !== realValue) {
            await getConnection().transaction(async (tm) => {
              await tm.query(
                `
                update upvote
                set value = $1
                where "postId" = $2 and "userId" = $3
              `,
                [realValue, postId, userId]
              );
      
              await tm.query(
                `
                update post
                set points = points + $1
                where id = $2
              `,
                [2 * realValue, postId]
              );
            });
          } else if (!upvote) {
            // has never voted before
            await getConnection().transaction(async (tm) => {
              await tm.query(
                `
                insert into upvote ("userId", "postId", value)
                values ($1, $2, $3)
              `,
                [userId, postId, realValue]
              );
      
              await tm.query(
                `
                update post
                set points = points + $1
                where id = $2
            `,
                [realValue, postId]
              );
            });
          }
          return true;
    }
    


    @Mutation(()=> Post)
    @UseMiddleware(isAuth)
    createPost(
        @Arg('input') input: PostInput,
        @Ctx() {req}: MyContext
    ): Promise<Post>{


        return Post.create({
            ...input,
            creatorId: req.session.userId
        }).save()

    }


    @Query(()=>PaginatedPosts)
        async posts(
        @Arg('limit', ()=>Int) limit: number,
        @Arg('cursor', ()=> String, {nullable: true}) cursor: string | null,
        @Ctx() {req}: MyContext
    ) {

        const realLimit = Math.min(50, limit);
        const reaLimitPlusOne = realLimit + 1;
    
        const replacements: any[] = [reaLimitPlusOne]; 



    
        if (cursor) {
          replacements.push(new Date(parseInt(cursor)));
 

        }


    
        const posts = await getConnection().query(
          `
          select p.*
          from post p
          ${cursor ? `where p."createdAt" < $2` : ''}
          order by p."createdAt" DESC
          limit $1
        `,
          replacements
        );

        // const qb = getManager()
        //         .createQueryBuilder(Post, 'p')
        //         .innerJoinAndSelect(
        //             'p.creator',
        //             'u',
        //             'u.id = p."creatorId"'
        //         )
        //         .orderBy('p."createdAt"', "DESC")
        //         .take(realLimit)
                

        //         if(cursor){
        //             qb.where('p."createdAt" < :cursor', {
        //                 cursor: new Date(parseInt(cursor))
        //             })
        //         }

        // const posts = await qb.getMany()


        return  {
            posts: posts.slice(0, realLimit),
            hasMore: true,
        }

            
        
    }

    @Query(()=>Post, {nullable: true})
    post(
        @Arg('id', ()=> Int) id: number
    ){
        return Post.findOne({id: id})
    }

    @Mutation(()=> Boolean, {nullable: true})
    async updatePost(
        @Arg('id', ()=> Int) id: number,
        @Arg('title', ()=> String) title: string
    ){
        await Post.update({id}, {title})
        return true
        
    }
}