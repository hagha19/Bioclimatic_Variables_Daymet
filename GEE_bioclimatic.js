// Define region of interest (ROI)
var roi = table;
Map.addLayer(table);


var exportParams = {
  collection: table,
  description: 'export_shapefile', // File name prefix
  fileFormat: 'SHP', // Export as shapefile
};
  
// Initiate export
Export.table.toDrive(exportParams);
// Define the year of interest
var year = 2018;

// Load DAYMET_V4 data
var daymet = ee.ImageCollection('NASA/ORNL/DAYMET_V4')
    .filterBounds(roi)
    .filter(ee.Filter.calendarRange(year, year, 'year'));

// Function to accumulate degree days over time
var accumulateDegreeDays = function(imageCollection) {
  var firstImage = ee.Image(imageCollection.first()).select([0], ['dd_accumulated']).set('system:time_start', imageCollection.first().get('system:time_start'));
  var restImages = imageCollection.toList(imageCollection.size()).slice(1);
  
  var cumulative = ee.Image(restImages.iterate(function(image, result) {
    image = ee.Image(image);
    result = ee.Image(result);
    var accumulated = result.select('dd_accumulated').add(image.select('tmax'));
    return accumulated.set('system:time_start', image.get('system:time_start'));
  }, firstImage));
  
  return cumulative.set('system:time_start', firstImage.get('system:time_start'));
};


// Display the cumulative degree days on the map
Map.addLayer(cumulativeDegreeDays, {min: 0, max: 2000, palette: ['white', 'green']}, 'Cumulative Degree Days Above 0°C');




// BIO1 : Calculate annual mean temperature
var meanDiurnalRange = daymet.select(['tmax', 'tmin'])
    .reduce(ee.Reducer.mean())
    .rename('meanmax' ,'meanmin');
    
var BIO1 = meanDiurnalRange.select('meanmax').add(meanDiurnalRange.select('meanmin')).divide(2);

// BIO2 : Calculate Mean Diurnal Range
var calculateMonthlyAverage = function(month) {
  // Filter the collection for the specific month
  var monthlyCollection = daymet.filter(ee.Filter.calendarRange(month, month, 'month'));

  // Calculate the mean for each pixel in the collection
  var monthlyAverage = monthlyCollection.reduce(ee.Reducer.mean());

  // Set the month as an image property
  var monthImage = ee.Image.constant(month).int16();
  monthlyAverage = monthlyAverage.addBands(monthImage.rename('month'));

  return monthlyAverage.set('system:time_start', ee.Date.fromYMD(2000, month, 1));
};

var months = ee.List.sequence(1, 12);

var monthlyAverages = ee.ImageCollection.fromImages(months.map(calculateMonthlyAverage));

var average_month = function(image) {
  var average = image.select('tmax_mean').subtract(image.select('tmin_mean'));
  return average.set('system:time_start', image.get('system:time_start')).rename('max-min');
};

var BIO2 = monthlyAverages.map(average_month).mean();

// BIO5 : Calculate Max Temperature of Warmest Month.
var julyCollection = daymet.filter(ee.Filter.calendarRange(7, 7, 'month'));
var BIO5 = julyCollection.reduce(ee.Reducer.max()).select('tmax_max');

// BIO6 : Min Temperature of Coldest Month.
var februaryCollection = daymet.filter(ee.Filter.calendarRange(2, 2, 'month'));
var BIO6 = februaryCollection.reduce(ee.Reducer.min()).select('tmin_min');

// BIO7 : Temperature Annual Range (BIO5-BIO6)
var BIO7 = BIO5.subtract(BIO6);


// BIO3 : Isothermality (BIO2/BIO7) (×100).
var BIO3 = BIO2.divide(BIO7).multiply(100);

// BIO4 : Temperature Seasonality (standard deviation ×100). The standard deviation of the 12 mean monthly temperature values is calculated
var average_month1 = function(image) {
  var average = (image.select('tmax_mean').add(image.select('tmin_mean'))).divide(2);
  return average.set('system:time_start', image.get('system:time_start')).rename('meanMonth');
};
var combinedImage = monthlyAverages.map(average_month1).toBands();
var BIO4 = combinedImage.reduce(ee.Reducer.stdDev());

// BIO8 : Mean temperature of wettest quarter.
var average_month = function(image) {
  var average = (image.select('tmax').add(image.select('tmin'))).divide(2);
  return average.set('system:time_start', image.get('system:time_start')).rename('meanMonth');
};
var wettestQuarter = daymet.filter(ee.Filter.calendarRange(6, 8, 'month'));
var BIO8 = wettestQuarter.map(average_month).toBands().reduce(ee.Reducer.mean());
Map.addLayer(BIO8, null, 'bio 8')

// BIO9 : Mean temperature of driest quarter.
var startPreviousDecember = ee.Date.fromYMD(year - 1, 12, 1);
var endPreviousDecember = ee.Date.fromYMD(year - 1, 12, 31);
var decemberOfPreviousYear = ee.ImageCollection('NASA/ORNL/DAYMET_V4')
    .filterBounds(roi).filterDate(startPreviousDecember, endPreviousDecember);
var driestQuarter = ee.ImageCollection(decemberOfPreviousYear.merge(daymet.filter(ee.Filter.calendarRange(1, 2, 'month')).filterBounds(roi)));
var BIO9 = driestQuarter.map(average_month).toBands().reduce(ee.Reducer.mean());

// BIO10 : Mean Temperature of Warmest Quarter.
var warmestQuarterCollection = daymet.filter(ee.Filter.calendarRange(5, 7, 'month'));
var average_month2 = function(image) {
  var average = (image.select('tmax').add(image.select('tmin'))).divide(2);
  return average.set('system:time_start', image.get('system:time_start')).rename('mean');
};
var combinedImage = warmestQuarterCollection.map(average_month2);
var BIO10 = combinedImage.reduce(ee.Reducer.mean()).clip(roi);

// BIO11 : Mean Temperature of coldest Quarter.
var startPreviousDecember = ee.Date.fromYMD(year - 1, 12, 1);
var endPreviousDecember = ee.Date.fromYMD(year - 1, 12, 31);
var decemberOfPreviousYear = ee.ImageCollection('NASA/ORNL/DAYMET_V4')
    .filterBounds(roi).filterDate(startPreviousDecember, endPreviousDecember);
var coldestQuarterCollection = ee.ImageCollection(decemberOfPreviousYear.merge(daymet.filter(ee.Filter.calendarRange(1, 2, 'month')).filterBounds(roi)));

var average_month2 = function(image) {
  var average = (image.select('tmax').add(image.select('tmin'))).divide(2);
  return average.set('system:time_start', image.get('system:time_start')).rename('mean');
};
var combinedImage = coldestQuarterCollection.map(average_month2);
var BIO11 = combinedImage.reduce(ee.Reducer.mean()).clip(roi);


// BIO12 : Annual Precipitation.
var BIO12 = daymet.reduce(ee.Reducer.sum()).select('prcp_sum');

// BIO13 : Precipitation of Wettest Month.
var wettestMonth = daymet.filter(ee.Filter.calendarRange(7, 7, 'month'));
var BIO13 = wettestMonth.select('prcp').reduce(ee.Reducer.sum());


// BI14 : Precipitation of Driest Month
var driestMonth = daymet.filter(ee.Filter.calendarRange(2, 2, 'month'));
var BIO14 = driestMonth.select('prcp').reduce(ee.Reducer.sum());

// BIO15 : Precipitaion Seasonality (standard deviation ×100). The standard deviation of the 12 mean monthly temperature values is calculated
var BIO15 = daymet.select('prcp').reduce(ee.Reducer.stdDev());

// BIO16 : Precipitation of Wettest Quarter.
var wettestQuarter = daymet.filter(ee.Filter.calendarRange(6, 8, 'month'));
var BIO16 = wettestQuarter.select('prcp').reduce(ee.Reducer.sum());

// BIO17 : Precipitation of Driest Quarter.
var startPreviousDecember = ee.Date.fromYMD(year - 1, 12, 1);
var endPreviousDecember = ee.Date.fromYMD(year - 1, 12, 31);
var decemberOfPreviousYear = ee.ImageCollection('NASA/ORNL/DAYMET_V4')
    .filterBounds(roi).filterDate(startPreviousDecember, endPreviousDecember);
var driestQuarter = ee.ImageCollection(decemberOfPreviousYear.merge(daymet.filter(ee.Filter.calendarRange(1, 2, 'month')).filterBounds(roi)));
var BIO17 = driestQuarter.select('prcp').reduce(ee.Reducer.sum());

// BIO18 : Precipitation of Warmest Quarter.
var warmestQuarterCollection = daymet.filter(ee.Filter.calendarRange(5, 7, 'month'));
var BIO18 = warmestQuarterCollection.select('prcp').reduce(ee.Reducer.sum());

// BIO19 : Precipitation of Coldest Quarter.
var startPreviousDecember = ee.Date.fromYMD(year - 1, 12, 1);
var endPreviousDecember = ee.Date.fromYMD(year - 1, 12, 31);
var decemberOfPreviousYear = ee.ImageCollection('NASA/ORNL/DAYMET_V4')
    .filterBounds(roi).filterDate(startPreviousDecember, endPreviousDecember);
var coldestQuarterCollection = ee.ImageCollection(decemberOfPreviousYear.merge(daymet.filter(ee.Filter.calendarRange(1, 2, 'month')).filterBounds(roi)));
var BIO19 = coldestQuarterCollection.select('prcp').reduce(ee.Reducer.sum());

var convertToFloat = function(image) {
  return image.toFloat();
};

var floatBIO1 = convertToFloat(BIO1);
var floatBIO2 = convertToFloat(BIO2);
var floatBIO3 = convertToFloat(BIO3);
var floatBIO4 = convertToFloat(BIO4);
var floatBIO5 = convertToFloat(BIO5);
var floatBIO6 = convertToFloat(BIO6);
var floatBIO7 = convertToFloat(BIO7);
var floatBIO8 = convertToFloat(BIO8);
var floatBIO9 = convertToFloat(BIO9);
var floatBIO10 = convertToFloat(BIO10);
var floatBIO11 = convertToFloat(BIO11);
var floatBIO12 = convertToFloat(BIO12);
var floatBIO13 = convertToFloat(BIO13);
var floatBIO14 = convertToFloat(BIO14);
var floatBIO15 = convertToFloat(BIO15);
var floatBIO16 = convertToFloat(BIO16);
var floatBIO17 = convertToFloat(BIO17);
var floatBIO18 = convertToFloat(BIO18);
var floatBIO19 = convertToFloat(BIO19);
var multibandImage = ee.Image.cat([floatBIO1, floatBIO2, floatBIO3, floatBIO4, floatBIO5, floatBIO6, floatBIO7, floatBIO8, floatBIO9, floatBIO10, floatBIO11,floatBIO12, floatBIO13,floatBIO14, floatBIO15,floatBIO16, floatBIO17,floatBIO18, floatBIO19]);
var renamedImage = multibandImage.rename([
  'BIO1', 'BIO2', 'BIO3', 'BIO4', 'BIO5',
  'BIO6', 'BIO7', 'BIO8', 'BIO9', 'BIO10',
  'BIO11', 'BIO12', 'BIO13', 'BIO14', 'BIO15',
  'BIO16', 'BIO17', 'BIO18', 'BIO19'
]);
// Print the combined image to see the band names and types
print(renamedImage);

// Export the multiband image to Drive
Export.image.toDrive({
  image: multibandImage,
  description: 'bioclimate_' + year,
  region: roi,
  scale: 1000
});
