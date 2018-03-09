const request = require('request-promise')
const cheerio = require('cheerio')
const P = require('bluebird')
const fs = require('fs')

let catalogUrl = "https://www.footlocker.co.uk/INTERSHOP/web/WFS/Footlocker-Footlocker_GB-Site/en_GB/-/GBP/ViewStandardCatalog-ProductPagingAjax?SearchParameter=____&sale=sale&MultiCategoryPathAssignment=all&PageNumber=1"

const items = []

function requestCatalog(url) {
  console.log('Loading content');
  return request({
    url,
    json: true
  })
  .then(data => {
    const $ = cheerio.load(data.content)
    const nextUrl = $('[data-ajaxcontent="productpagebutton"] .fl-btn.fl-btn__default').attr('data-ajaxcontent-url')

    $('.fl-category--productlist--item > .fl-product-tile--container').each((index, item) => {
      items.push($(item).attr('data-request')+ '&ajax=1&page=1')
    })
    if(nextUrl) {
      requestCatalog(nextUrl)
    } else {
      requestItems(items)
    }
  })
  .catch(error => {
    console.error(error);
  })
}
requestCatalog(catalogUrl)

function requestItems(items) {
  const itemsJson = []
  console.log(`TOTAL PRODUCTS FOUND: ${items.length}`);
  console.log('GETTING PRODUCT DETAILS');
  let delay = 0
  Promise.all(items.map(item => {
    delay += 600
    return delayRequest(item, delay)
  }))
  .then(itemsDetails => {
    itemsDetails.forEach(item => {
      const $ = cheerio.load(item.content);
      const details = {}
      details.name = $('.fl-product-tile--name span').html()
      details.salePrice = $('.fl-price--sale__highlighted span').html()
      details.oldPrice = $('.fl-price--old--value span').html()
      details.sizeUrl = $('.fl-product-tile--details.fl-product-tile--details__active form > div:first-of-type').attr('data-ajaxcontent-url')
      details.image = $('.fl-picture--img').attr('srcset')
      itemsJson.push(details)
    })
    return itemsJson
  })
  .then(itemSizes => {
    console.log('GETTING SIZES');
    let delay = 0
    return Promise.all(itemSizes.map(item => {
      delay += 600
      return delayRequest(item.sizeUrl, delay)
      .then(sizeData => {
        const $ = cheerio.load(sizeData.content);
        const sizeList = $('.fl-accordion-tab.fl-accordion-tab__tab.fl-accordion-tab__tab-table.fl-accordion-tab__tab-simple')

        const sizes = {
          UK: [],
          US: [],
          EU: []
        }
        sizeList.find('label:contains("UK") ~ .fl-accordion-tab--content .fl-product-size button span')
        .each((i, v) => {
          sizes.UK.push($(v).text())
        })
        sizeList.find('label:contains("US") ~ .fl-accordion-tab--content .fl-product-size button span')
        .each((i, v) => {
          sizes.US.push($(v).text())
        })
        sizeList.find('label:contains("EU") ~ .fl-accordion-tab--content .fl-product-size button span')
        .each((i, v) => {
          sizes.EU.push($(v).text())
        })
        item.sizes = sizes
        delete item.sizeUrl
        return item
      })
    }))
  })
  .then(items => {
    fs.writeFile('products.json', JSON.stringify(items, null, ' '), () => {
      console.log('DONE!!!');
    })
  })
  .catch(error => {
    console.error(error);
  })
}

function delayRequest(url, delay) {
  return P.delay(delay)
  .then(() => {
    return request({
      url,
      json: true,
    })
  })
}
