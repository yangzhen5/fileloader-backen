// multiparty fs-extra cors body-parser nodemon
//npm i multiparty
const express=require('express')
const path=require('path')
const mutiparty=require('multiparty')
const fse=require('fs-extra')
const cors=require('cors')
const bodyParser=require('body-parser')

const app=express()
app.use(bodyParser.json())
app.use(cors())

const UPLOAD_DIR=path.resolve(__dirname,'uploads')

//每个分片一个请求
app.post('/upload', function(req,res){
    const form=new mutiparty.Form()
    form.parse(req,async function(err,fields,files){
        if(err){
            res.status(401).json({
                ok:false,
                msg:"上次上传失败，请重新上传"
            })
            return 
        }
        // console.log(fields)
        // console.log(files)
        //临时存放目录
        // const fileName=fields['fileName'][0]
        const fileHash=fields['fileHash'][0]
        const chunkHashIndex=fields['chunkHash'][0]
        const filePath=path.resolve(UPLOAD_DIR,fileHash)
        if(!fse.existsSync(filePath)){//不存在目录就创建
            await fse.mkdir(filePath)
        }
        const oldPath=files['chunk'][0]['path']
        // 当前分片名称
        const newIndexPath=path.resolve(filePath,chunkHashIndex)
        
        if(!fse.existsSync(newIndexPath)){
            await fse.move(oldPath,newIndexPath)
        }
        res.status(200).json({
            ok:true,
            msg:  `分片${chunkHashIndex}上传成功`
        })
    })
})

//提取文件后缀名   
const extractExt=fileName=>{
    return fileName.slice(fileName.lastIndexOf('.'),fileName.length)
}
app.post('/merge',async function(req,res){
    const {fileHash,fileName,size}=req.body
    // console.log(fileHash,fileName,size)
    //如果存在合并后的文件 就没有必要合并
    const filePath=path.resolve(UPLOAD_DIR,fileHash+extractExt(fileName))
    if(fse.existsSync(filePath)){
        res.status(200).json({
            ok:true,
            msg:'合并：妙传：成功'
        })
        return 
    }
    //如果不存在该文件夹，
    const chunkDir=path.resolve(UPLOAD_DIR,fileHash)
    if(!fse.existsSync(chunkDir)){
        res.status(401).json({
            ok:false,
            msg:'合并失败:不存在文件夹'
        })
    }else{
        //合并文件 读写文件流
        const chunPaths=await fse.readdir(chunkDir)//异步读取给定目录的内容,返回目录中所有文件名的数组.
        // console.log(chunPaths)
        chunPaths.sort((a,b)=>{
            return a.split('-')[1]-b.split('-')[1]
        })
        const list=chunPaths.map((chunkName,index)=>{
            return new Promise(resolve=>{
                const chunkPath=path.resolve(chunkDir,chunkName)
                const readStream=fse.createReadStream(chunkPath)
                const writeStream=fse.createWriteStream(filePath,{
                    start:index*size,
                    end:(index+1)*size
                })
                //删除切片
                readStream.on('end',async ()=>{
                    await fse.unlink(chunkPath)//异步删除文件
                    resolve()
                })
                //将读流引入到写流
                readStream.pipe(writeStream)
            })
        })
        // console.log('aaaa')
        await Promise.all(list)
        await fse.remove(chunkDir)//目录内的所有文件都将被删除

        res.status(200).json({
            ok:true,
            msg:'合并成功'
        })
    }
})
app.post('/verify',async function(req,res){
    const {fileHash,fileName}=req.body
    // console.log(fileHash,fileName)
    //当前文件是否存在
    const fileNamePath=path.resolve(UPLOAD_DIR,fileHash+extractExt(fileName))
    // console.log('filenamepath:',fileNamePath)
    if(fse.existsSync(fileNamePath)){
        res.status(200).json({
            ok:true,
            data:{
                shouldUpload:false
            }
        })
        return 
    }else{
        //已上传的分片
        const chunkDir=path.resolve(UPLOAD_DIR,fileHash)
        let chunkPaths=[]
        if(fse.existsSync(chunkDir)){
            chunkPaths=await fse.readdir(chunkDir)
        }
         res.status(200).json({
            ok:true,
            data:{
                shouldUpload:true,
                existChunks:chunkPaths
            }
        })
        return 
    }
})
app.listen(3000,()=>{
    console.log('server running')
})