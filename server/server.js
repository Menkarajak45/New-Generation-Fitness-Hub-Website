import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();
const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error("Set JWT_SECRET to a random value of at least 32 characters in server/.env."); process.exit(1); }

const userSchema = new mongoose.Schema({
  name: {type:String, required:true, trim:true}, email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  phone:{type:String,default:""}, password:{type:String,required:true}, role:{type:String,enum:["admin","member"],default:"member"},
  active:{type:Boolean,default:true}
},{timestamps:true});
const User = mongoose.model("User",userSchema);
const planSchema = new mongoose.Schema({name:{type:String,required:true},durationDays:{type:Number,required:true,min:1},durationLabel:String,price:{type:Number,required:true,min:0},originalPrice:{type:Number,min:0},description:String,features:[String],active:{type:Boolean,default:true}},{timestamps:true});
const Plan = mongoose.model("Plan",planSchema);
const memberSchema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,unique:true},
  memberCode:{type:String,unique:true}, plan:{type:mongoose.Schema.Types.ObjectId,ref:"Plan"},
  startDate:{type:Date,default:Date.now}, expiryDate:Date, status:{type:String,enum:["active","expired","suspended"],default:"active"},
  notes:String
},{timestamps:true});
const Member = mongoose.model("Member",memberSchema);
const paymentSchema = new mongoose.Schema({member:{type:mongoose.Schema.Types.ObjectId,ref:"Member",required:true},amount:{type:Number,required:true,min:0},method:{type:String,enum:["cash","upi","card","bank transfer"],default:"upi"},status:{type:String,enum:["paid","pending","refunded"],default:"paid"},description:String,paidAt:{type:Date,default:Date.now},receiptNo:{type:String,unique:true}},{timestamps:true});
const Payment = mongoose.model("Payment",paymentSchema);
const attendanceSchema = new mongoose.Schema({member:{type:mongoose.Schema.Types.ObjectId,ref:"Member",required:true},checkIn:{type:Date,default:Date.now},checkOut:Date,markedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}},{timestamps:true});
const Attendance = mongoose.model("Attendance",attendanceSchema);
const trainerSchema = new mongoose.Schema({name:{type:String,required:true},email:String,phone:String,specialty:String,joiningDate:Date,salary:Number,active:{type:Boolean,default:true}},{timestamps:true});
const Trainer = mongoose.model("Trainer",trainerSchema);
const expenseSchema = new mongoose.Schema({title:{type:String,required:true},category:String,amount:{type:Number,required:true,min:0},date:{type:Date,default:Date.now},notes:String},{timestamps:true});
const Expense = mongoose.model("Expense",expenseSchema);
const settingsSchema = new mongoose.Schema({key:{type:String,unique:true},value:mongoose.Schema.Types.Mixed});
const Setting = mongoose.model("Setting",settingsSchema);

const safeUser = u => ({id:u._id,name:u.name,email:u.email,phone:u.phone,role:u.role});
function sign(u){return jwt.sign({sub:u._id.toString(),role:u.role},JWT_SECRET,{expiresIn:"12h"});}
async function auth(req,res,next){
  try { const h=req.headers.authorization||""; const token=h.startsWith("Bearer ")?h.slice(7):""; if(!token) return res.status(401).json({message:"Please sign in."});
    const payload=jwt.verify(token,JWT_SECRET); const user=await User.findById(payload.sub); if(!user||!user.active) return res.status(401).json({message:"Account unavailable."});
    req.user=user; next();
  } catch { return res.status(401).json({message:"Session expired. Please sign in again."}); }
}
const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({message:"You do not have permission to perform this action."});
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const populatedMember = Member.find().populate("user","name email phone").populate("plan");
app.get("/api/health",(req,res)=>res.json({status:"ok",service:"New Generation Fitness Hub API"}));

app.post("/api/auth/register",asyncRoute(async(req,res)=>{
  const {name,email,password,phone}=req.body;
  if(!name||!email||!password||password.length<8) return res.status(400).json({message:"Name, valid email and password (minimum 8 characters) are required."});
  if(await User.exists({email:email.toLowerCase()})) return res.status(409).json({message:"An account with this email already exists."});
  const user=await User.create({name,email,password:await bcrypt.hash(password,12),phone,role:"member"});
  const member=await Member.create({user:user._id,memberCode:"NGFH-"+Date.now().toString().slice(-7)});
  res.status(201).json({token:sign(user),user:safeUser(user),memberId:member._id});
}));
app.post("/api/auth/login",asyncRoute(async(req,res)=>{
  const {email,password}=req.body; const user=await User.findOne({email:String(email||"").toLowerCase()});
  if(!user||!user.active||!await bcrypt.compare(password||"",user.password)) return res.status(401).json({message:"Invalid email or password."});
  res.json({token:sign(user),user:safeUser(user)});
}));
app.get("/api/auth/me",auth,asyncRoute(async(req,res)=>res.json({user:safeUser(req.user)})));

app.get("/api/dashboard",auth,asyncRoute(async(req,res)=>{
  if(req.user.role==="member"){
    const member=await Member.findOne({user:req.user._id});
    if(member?.expiryDate && member.expiryDate < new Date() && member.status==="active"){member.status="expired";await member.save();}
    await member?.populate("plan");
    if(!member) return res.status(404).json({message:"Member profile not found."});
    const [payments,attendance]=await Promise.all([Payment.find({member:member._id}).sort({paidAt:-1}).limit(10),Attendance.find({member:member._id}).sort({checkIn:-1}).limit(10)]);
    return res.json({member,payments,attendance});
  }
  const [members,payments,expenses,attendance,expiring]=await Promise.all([
    Member.countDocuments(),Payment.aggregate([{$match:{status:"paid"}},{$group:{_id:null,total:{$sum:"$amount"}}}]),
    Expense.aggregate([{$group:{_id:null,total:{$sum:"$amount"}}}]),Attendance.countDocuments({checkIn:{$gte:new Date(new Date().setHours(0,0,0,0))}}),
    Member.countDocuments({expiryDate:{$gte:new Date(),$lte:new Date(Date.now()+7*86400000)}})
  ]);
  res.json({members,revenue:payments[0]?.total||0,expenses:expenses[0]?.total||0,todayAttendance:attendance,expiring});
}));

app.get("/api/members",auth,roles("admin"),asyncRoute(async(req,res)=>{
  await Member.updateMany({expiryDate:{$lt:new Date()},status:"active"},{$set:{status:"expired"}});
  const rows=await Member.find().populate("user","name email phone active").populate("plan").sort({createdAt:-1}); res.json(rows);
}));
app.post("/api/members",auth,roles("admin"),asyncRoute(async(req,res)=>{
  const {name,email,phone,password,planId,startDate,expiryDate,notes}=req.body;
  if(!name||!email||!password||password.length<8) return res.status(400).json({message:"Name, email and password (minimum 8 characters) are required."});
  if(await User.exists({email:email.toLowerCase()})) return res.status(409).json({message:"Email already exists."});
  const user=await User.create({name,email,phone,password:await bcrypt.hash(password,12),role:"member"});
  const member=await Member.create({user:user._id,memberCode:"NGFH-"+Date.now().toString().slice(-7),plan:planId||undefined,startDate:startDate||new Date(),expiryDate,notes});
  res.status(201).json(await Member.findById(member._id).populate("user","name email phone").populate("plan"));
}));
app.patch("/api/members/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{
  const m=await Member.findById(req.params.id); if(!m)return res.status(404).json({message:"Member not found."});
  const {name,email,phone,planId,startDate,expiryDate,status,notes}=req.body;
  if(name||email||phone!==undefined) await User.findByIdAndUpdate(m.user,{...(name?{name}:{}),...(email?{email}:{}),...(phone!==undefined?{phone}:{})});
  Object.assign(m,{...(planId!==undefined?{plan:planId||null}:{}),...(startDate?{startDate}:{}),...(expiryDate?{expiryDate}:{}),...(status?{status}:{}),...(notes!==undefined?{notes}:{})});
  await m.save(); res.json(await Member.findById(m._id).populate("user","name email phone").populate("plan"));
}));
app.delete("/api/members/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{
 const m=await Member.findById(req.params.id); if(!m)return res.status(404).json({message:"Member not found."});
 await Promise.all([User.findByIdAndUpdate(m.user,{active:false}),Member.deleteOne({_id:m._id})]); res.json({message:"Member deactivated and profile removed."});
}));

app.get("/api/public/plans",asyncRoute(async(req,res)=>res.json(await Plan.find({active:true}).select("name durationDays durationLabel price originalPrice description features active").sort({name:1,durationDays:1}))));
app.get("/api/plans",auth,asyncRoute(async(req,res)=>res.json(await Plan.find(req.user.role==="admin"?{}:{active:true}).sort({price:1}))));
app.post("/api/plans",auth,roles("admin"),asyncRoute(async(req,res)=>res.status(201).json(await Plan.create(req.body))));
app.patch("/api/plans/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{const p=await Plan.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});if(!p)return res.status(404).json({message:"Plan not found."});res.json(p)}));
app.delete("/api/plans/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{await Plan.findByIdAndUpdate(req.params.id,{active:false});res.json({message:"Plan archived."})}));

app.get("/api/payments",auth,asyncRoute(async(req,res)=>{
 let query={}; if(req.user.role==="member"){const m=await Member.findOne({user:req.user._id});query.member=m?._id||null;}
 res.json(await Payment.find(query).populate({path:"member",populate:{path:"user",select:"name email"}}).sort({paidAt:-1}));
}));
app.post("/api/payments",auth,roles("admin"),asyncRoute(async(req,res)=>{
 const {memberId,amount,method,status,description,paidAt}=req.body;
 if(!memberId||!amount||Number(amount)<=0)return res.status(400).json({message:"Member and a valid amount are required."});
 const p=await Payment.create({member:memberId,amount:Number(amount),method,status,description,paidAt,receiptNo:"NGFH-R-"+Date.now()});
 res.status(201).json(await p.populate({path:"member",populate:{path:"user",select:"name email"}}));
}));
app.patch("/api/payments/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{const p=await Payment.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});if(!p)return res.status(404).json({message:"Payment not found."});res.json(p)}));

app.get("/api/attendance",auth,asyncRoute(async(req,res)=>{
 let query={}; if(req.user.role==="member"){const m=await Member.findOne({user:req.user._id});query.member=m?._id||null;}
 res.json(await Attendance.find(query).populate({path:"member",populate:{path:"user",select:"name email"}}).sort({checkIn:-1}).limit(300));
}));
app.post("/api/attendance/checkin",auth,asyncRoute(async(req,res)=>{
 let memberId=req.body.memberId;
 if(req.user.role==="member"){const m=await Member.findOne({user:req.user._id});if(!m)return res.status(404).json({message:"Member profile not found."});memberId=m._id;}
 else if(!memberId)return res.status(400).json({message:"Select a member."});
 const member=await Member.findById(memberId); if(member?.expiryDate && member.expiryDate < new Date() && member.status==="active"){member.status="expired";await member.save();} if(!member||member.status!=="active")return res.status(400).json({message:"Only active members can check in."});
 const start=new Date();start.setHours(0,0,0,0); const exists=await Attendance.exists({member:memberId,checkIn:{$gte:start},checkOut:null});
 if(exists)return res.status(409).json({message:"This member is already checked in today."});
 res.status(201).json(await Attendance.create({member:memberId,markedBy:req.user._id}));
}));
app.patch("/api/attendance/:id/checkout",auth,asyncRoute(async(req,res)=>{
 const row=await Attendance.findById(req.params.id); if(!row)return res.status(404).json({message:"Attendance record not found."});
 if(req.user.role==="member"){const m=await Member.findOne({user:req.user._id});if(!m||!row.member.equals(m._id))return res.status(403).json({message:"Not your attendance record."});}
 row.checkOut=new Date();await row.save();res.json(row);
}));

app.get("/api/trainers",auth,roles("admin","trainer"),asyncRoute(async(req,res)=>res.json(await Trainer.find().sort({name:1}))));
app.post("/api/trainers",auth,roles("admin"),asyncRoute(async(req,res)=>res.status(201).json(await Trainer.create(req.body))));
app.patch("/api/trainers/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{const t=await Trainer.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});if(!t)return res.status(404).json({message:"Trainer not found."});res.json(t)}));
app.delete("/api/trainers/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{await Trainer.findByIdAndUpdate(req.params.id,{active:false});res.json({message:"Trainer archived."})}));

app.get("/api/expenses",auth,roles("admin"),asyncRoute(async(req,res)=>res.json(await Expense.find().sort({date:-1}))));
app.post("/api/expenses",auth,roles("admin"),asyncRoute(async(req,res)=>res.status(201).json(await Expense.create(req.body))));
app.patch("/api/expenses/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{const e=await Expense.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});if(!e)return res.status(404).json({message:"Expense not found."});res.json(e)}));
app.delete("/api/expenses/:id",auth,roles("admin"),asyncRoute(async(req,res)=>{await Expense.findByIdAndDelete(req.params.id);res.json({message:"Expense deleted."})}));

app.get("/api/settings",auth,roles("admin"),asyncRoute(async(req,res)=>{const s=await Setting.find();res.json(Object.fromEntries(s.map(x=>[x.key,x.value])))}));
app.put("/api/settings",auth,roles("admin"),asyncRoute(async(req,res)=>{for(const [key,value] of Object.entries(req.body))await Setting.findOneAndUpdate({key},{key,value},{upsert:true,new:true});res.json({message:"Settings saved."})}));
app.get("/api/reports/summary",auth,roles("admin"),asyncRoute(async(req,res)=>{
 const [memberCount,paymentAgg,expenseAgg,planCounts]=await Promise.all([
 Member.countDocuments(),Payment.aggregate([{$match:{status:"paid"}},{$group:{_id:null,total:{$sum:"$amount"},count:{$sum:1}}}]),
 Expense.aggregate([{$group:{_id:null,total:{$sum:"$amount"}}}]),Member.aggregate([{$group:{_id:"$plan",count:{$sum:1}}},{$lookup:{from:"plans",localField:"_id",foreignField:"_id",as:"plan"}}])
 ]);
 res.json({memberCount,revenue:paymentAgg[0]?.total||0,paidTransactions:paymentAgg[0]?.count||0,expenses:expenseAgg[0]?.total||0,planCounts});
}));

app.use((err,req,res,next)=>{console.error(err);if(err.code===11000)return res.status(409).json({message:"A record with that unique value already exists."});res.status(500).json({message:process.env.NODE_ENV==="production"?"Server error. Please try again.":err.message});});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
if(process.env.NODE_ENV==="production"){app.use(express.static(path.resolve(__dirname,"../client/dist")));app.get("*",(req,res)=>res.sendFile(path.resolve(__dirname,"../client/dist/index.html")));}
mongoose.connect(process.env.MONGODB_URI||"mongodb://127.0.0.1:27017/new_generation_fitness_hub")
 .then(async()=>{
  await Member.updateMany({expiryDate:{$lt:new Date()},status:"active"},{$set:{status:"expired"}});
  if(await Plan.countDocuments()===0){
   const starter=[
    ...[[30,1200,1500],[90,2700,3500],[180,4500,6000],[365,7000,9000]].map(([durationDays,price,originalPrice])=>({name:"Gym Only",durationDays,durationLabel:({30:"1 Month",90:"3 Months",180:"6 Months",365:"12 Months"})[durationDays],price,originalPrice,description:"Strength training membership.",features:["Strength training","Workout area access","Changing facilities"],active:true})),
    ...[[30,1500,1800],[90,3500,4500],[180,5500,7000],[365,9500,12000]].map(([durationDays,price,originalPrice])=>({name:"Gym + Cardio",durationDays,durationLabel:({30:"1 Month",90:"3 Months",180:"6 Months",365:"12 Months"})[durationDays],price,originalPrice,description:"Strength training and cardio membership.",features:["Strength training","Cardio access","Changing facilities"],active:true})),
    ...[[30,4000],[90,10000],[180,15000]].map(([durationDays,price])=>({name:"Personal Training",durationDays,durationLabel:({30:"1 Month",90:"3 Months",180:"6 Months"})[durationDays],price,originalPrice:price,description:"Personalised training. Contact gym to confirm availability.",features:["Personalised guidance","Goal-focused sessions"],active:true}))
   ]; await Plan.insertMany(starter); console.log("Starter membership plans created.");
  }
  app.listen(PORT,()=>console.log(`NGFH API running on http://localhost:${PORT}`));
 })
 .catch(err=>{console.error("MongoDB connection failed:",err.message);process.exit(1)});
