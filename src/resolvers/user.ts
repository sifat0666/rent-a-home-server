import { User } from "./../entity/User";
// import { MyContext } from "src/types";
import { Arg, Ctx, Field, InputType, Mutation,  ObjectType,  Query,  Resolver } from "type-graphql";
import argon2 from "argon2";
import { MyContext } from "src/types";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "./../constants";
import { sendEmail } from "./../utils/sendEmail";
import {v4} from 'uuid'

@InputType()
export class UsernamePasswordInput{
    @Field()
    username: string
    @Field()
    email: string
    @Field()
    password: string
}

@ObjectType()
class FieldError{
    @Field()
    field: string

    @Field()
    message: string
}

@ObjectType()
class UserResponse{
    @Field(()=>[FieldError], {nullable: true})
    errors?: Error[]

    @Field(()=> User, {nullable: true})
    user?: User
    
}


@Resolver()
export class UserResolver{


    @Mutation(()=> Boolean)
    async forgotPassword(
        @Ctx() {redis}: MyContext,
        @Arg('email') email: string
    ){
        const user = await User.findOne({email: email})

        if(!user){
            return true
        }

        
        const token = v4()

        redis.set(FORGET_PASSWORD_PREFIX + token, user.id, 'ex', 1000* 60 * 60 * 24)

        const htmlMsg = `<a href='http://localhost:3000/change-password/${token}'>reset password</a>`

        await sendEmail(email, htmlMsg)

        return true
    }

    @Mutation(()=> UserResponse)
    async changePassword(
        @Arg('token') token: string,
        @Arg('newPassword') newPassword: string,
        @Ctx() {redis, req}: MyContext
    ){
        if(newPassword.length < 5){
            return{
                errors: [{
                    field: 'newPassword',
                    message: 'lenght must me greater than 5'
                }]
            }
        }


        const key = FORGET_PASSWORD_PREFIX+token
        

        const userId = await redis.get(key)

        if(!userId) {
            return{
                errors: [
                    {
                        field: 'token',
                        message: 'token expired'
                    }
                ]
            }
        }

        const user = await User.findOne({id: parseInt(userId)})

        if(!user) {
            return{
                errors: [
                    {
                        field: 'token',
                        message: 'user no longer exists'
                    }
                ]
            }
        }

        user.password = await argon2.hash(newPassword)

        await User.save(user)

        await redis.del(key)

        //logging user in
        req.session.userId = user.id

        return {user}

    }


    @Query(()=>User)
    async me(
        @Ctx() {req}: MyContext
    ){
        if(!req.session.userId){
            return null
        }

        const user = await User.findOne({id: req.session.userId})

        return user
    }

//----------REGISTER--------------
    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() {req}: MyContext
        // @Ctx() {em}: MyContext
    ){
        const { username, password, email} = options

        if(username.length < 3 ){
            return{
                errors: [{
                    field: 'username',
                    message: 'username must be longer than 3 charecters'
                }]
            }
        }
        if( !email.includes('@')){
            return{
                errors: [{
                    field: 'email',
                    message: 'invalid email'
                }]
            }
        }
        if( username.includes('@')){
            return{
                errors: [{
                    field: 'username',
                    message: 'can not include an @ sign'
                }]
            }
        }

        if(password.length < 5){
            return{
                errors: [{
                    field: 'password',
                    message: 'lenght must me greater than 5'
                }]
            }
        }


        const findByUser = await User.findOne({username: username})

        if(findByUser) return {
            errors: [{
                field: 'username',
                message: 'user already exists'
            }]
        }

        // const findByEmail = await User.findOne({email: email})

        // if(findByEmail) return {
        //     errors: [{
        //         field: 'email',
        //         message: 'email already exists'
        //     }]
        // }


        const hashedPassword = await argon2.hash(password)

        const user = await User.create({
            username,
            email,
            password :hashedPassword

        }).save()

        
        req.session.userId = user.id
        
        return {user}
    }

//----------------LOGIN---------------------
    @Mutation(() => UserResponse)
    async login(
        @Arg('userNameOrEmail') userNameOrEmail: string,
        @Arg('password') password: string,
        @Ctx() {req}: MyContext
    ){
        const identifier = userNameOrEmail.includes('@') ? {email: userNameOrEmail} : {username: userNameOrEmail}

        const user = await User.findOne(
            { where: identifier }
          )

        if(!user){
            return{
                errors: [
                    {
                        field: 'userNameOrEmail',
                        message: 'user does not exists'
                    }
                ]
            }
        } 


        const valid = await argon2.verify(user.password, password)

        

        if(!valid){
            return{
                errors: [
                    {
                        field: 'password',
                        message: "incorrect password"
                    }
                ]
            }
        }

        //logging user in via user id session
        req.session.userId = user.id
        
        return {user}
    }


    @Query(()=>[User])
    users(){
        return User.find({})
    }

    @Mutation(()=>Boolean)
    logout(
        @Ctx() {req, res}: MyContext
    ){
        return new Promise (resolve => req.session.destroy(err => {
            
            res.clearCookie(COOKIE_NAME)

            if(err){
                console.log(err)
                resolve(false)
                return
            }
            resolve(true)
        }))
    }
}


