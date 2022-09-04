const getPixels = require("get-pixels");
const quantize = require("quantize");
const { default: Axios } = require("axios");
const { fromBuffer } = require("file-type");

const isURL = (input) => /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi.test(input);

const getMimetypes = async (buffer) => {
	try {
		const { mime } = await fromBuffer(buffer);
		return mime;
	} catch (err) {
		return false;
	}
};

const getBuffer = async (url) => {
	try {
		const { data } = await Axios.get(url, { responseType: "arraybuffer" });
		return data;
	} catch (err) {
		return false;
	}
};

const createPixelArray = (imgData, pixelCount, quality) => {
	const pixels = imgData;
	const pixelArray = [];

	for (let i = 0, offset, r, g, b, a; i < pixelCount; i += quality) {
		offset = i * 4;
		r = pixels[offset + 0];
		g = pixels[offset + 1];
		b = pixels[offset + 2];
		a = pixels[offset + 3];

		// If pixel is mostly opaque and not white
		if ((typeof a === "undefined" || a >= 125) && !(r > 250 && g > 250 && b > 250)) {
			pixelArray.push([r, g, b]);
		}
	}
	return pixelArray;
};

const validateOptions = (options) => {
	let { colorCount, quality } = options;

	if (typeof colorCount === "undefined" || !Number.isInteger(colorCount)) {
		colorCount = 10;
	} else if (colorCount === 1) {
		throw new Error("colorCount should be between 2 and 20. To get one color, call getColor() instead of getPalette()");
	} else {
		colorCount = Math.max(colorCount, 2);
		colorCount = Math.min(colorCount, 20);
	}

	if (typeof quality === "undefined" || !Number.isInteger(quality) || quality < 1) {
		quality = 10;
	}

	return {
		colorCount,
		quality,
	};
};

const loadImg = (img, mime) =>
	new Promise((resolve, reject) => {
		try {
			const data = mime ? getPixels(img, mime) : getPixels(img);
			resolve(data);
		} catch (err) {
			reject(err);
		}
	});

const getColor = (img, quality) =>
	new Promise(async (resolve, reject) => {
		if (!img) {
			throw new Error("No image input.");
		}

		let mime;

		try {
			if (isURL(img)) {
				const data = await getBuffer(img);
				if (!data) {
					reject(new Error("URL seems to be invalid."));
				}

				img = data;
				mime = await getMimetypes(img);

				if (!mime) {
					reject(new Error("The URL returns Buffer that contains unsupported media format."));
				}
			} else if (Buffer.isBuffer(img)) {
				mime = await getMimetypes(img);

				if (!mime) {
					reject(new Error("The Buffer contains unsupported media format."));
				}
			}

			const palette = await getPalette(img, 5, quality);
			resolve(palette[0]);
		} catch (err) {
			reject(err);
		}
	});

const getPalette = (img, colorCount = 10, quality = 10) =>
	new Promise(async (resolve, reject) => {
		const options = validateOptions({
			colorCount,
			quality,
		});

		if (!img) {
			throw new Error("No image input.");
		}

		let mime;

		try {
			if (isURL(img)) {
				const data = await getBuffer(img);
				if (!data) {
					reject(new Error("URL seems to be invalid."));
				}

				img = data;
				mime = await getMimetypes(img);

				if (!mime) {
					reject(new Error("The URL returns Buffer that contains unsupported media format."));
				}
			} else if (Buffer.isBuffer(img)) {
				mime = await getMimetypes(img);

				if (!mime) {
					reject(new Error("The Buffer contains unsupported media format."));
				}
			}

			const imgData = await loadImg(img, mime);
			const pixelCount = imgData.shape[0] * imgData.shape[1];
			const pixelArray = createPixelArray(imgData.data, pixelCount, options.quality);

			const cmap = quantize(pixelArray, options.colorCount);
			const palette = cmap ? cmap.palette() : null;

			resolve(palette);
		} catch (err) {
			reject(err);
		}
	});

module.exports = {
	getColor,
	getPalette,
};
