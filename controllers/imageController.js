const axios = require('axios');
const cheerio = require('cheerio');
const fsp = require('fs/promises');
const fs = require('fs');
const sharp = require('sharp');
const os = require("os");
const ImageTracer = require('../imagetracer_v1.2.6');

const tempDir = os.tmpdir();
const drawingFilePath = `${tempDir}/drawing.jpg`;
const croppedDrawingFilePath = `${tempDir}/drawing-cropped.jpg`;
const trimmedDrawingFilePath = `${tempDir}/drawing-trimmed.jpg`;
const paddedDrawingFilePath = `${tempDir}/drawing-padded.jpg`;   //so the pencil won't get cut off
const svgFilePath = `${tempDir}/drawing.svg`;


async function imagetoSvg() {
    
    let svgContents;

    sharp.cache({ files : 0 });
    let image = sharp(drawingFilePath);
    let metadata = await image.metadata();

    await image
        .extract({
            left: 0,
            top: 0,
            width: metadata.width,
            height: metadata.height - 100})
        .toFile(croppedDrawingFilePath);
    
    await sharp(croppedDrawingFilePath)
        .trim()
        .toFile(trimmedDrawingFilePath);

    let pencilHeight = 100; // also in index.js
    await sharp(trimmedDrawingFilePath)
        .extend({
            top: pencilHeight,
            bottom: pencilHeight,
            left: pencilHeight,
            right: pencilHeight,
            background: 'white'
        })
        .toFile(paddedDrawingFilePath);

    image = sharp(paddedDrawingFilePath);
    metadata = await image.metadata();

    let buffer = await image
                        .raw()
                        .toBuffer({resolveWithObject: true})
                        .then(({ data, info }) => {
                            return data;
                        });

    var myImageData = { width:metadata.width, height:metadata.height, data:buffer };
    
    // tracing to SVG string
    var options = { scale: 0.5 }; // options object; option preset string can be used also
    
    var svgstring = ImageTracer.imagedataToSVG( myImageData, options );
    
    // writing to file
    await fsp.writeFile(svgFilePath,svgstring);

    await fsp.readFile(svgFilePath, 'utf-8')
        .then(contents => {
            svgContents = contents;
        });

    return svgContents;
}

async function downloadImage(url) {

    url = encodeURI(url);
    const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

    return new Promise((resolve, reject) => {
            response.data.pipe(fs.createWriteStream(drawingFilePath))
                .on('error', reject)
                .once('close', () => resolve(drawingFilePath)); 
        });
}

async function drawingScraper(subject) {

    let svgContents;
    const url = `https://iheartcraftythings.com/${subject}-drawing.html`;
    const imageOffset = 3;
    let imageSrc;

    await axios(url)
        .then(response => {
            const html_data = response.data;
            const $ = cheerio.load(html_data);
            let images = $('img.aligncenter');
            let ImgNum = images.length;
            imageSrc = images[ImgNum-imageOffset].attribs['data-src'];
        }).catch(error => {
            if (error.response.status == 404) {
                throw new TypeError('No image was found for the entered input. Please choose another subject.');
            } else {
                throw new Error(error.toString());
            }
        });

    await downloadImage(imageSrc);

    await imagetoSvg().then(
        (svg) => {
            svgContents = svg;
        }
    );

    return svgContents;
}

exports.GetImage = async (req, res) => {
    try {
        const svg = await drawingScraper(req.params.subject);
        return res.status(200).json({
            success: true,
            data: svg,
        });
    } catch (err) {
        if (err instanceof TypeError) {
            return res.status(404).json({
                error: err.message,
            });
        } else {
            return res.status(500).json({
                error: err.message,
            });
        }
    }
};