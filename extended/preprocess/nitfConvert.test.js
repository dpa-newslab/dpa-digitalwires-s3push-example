/* -*- coding: utf-8 -*-

 Copyright 2022, 2022 dpa-IT Services GmbH

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

'use strict'
import test from 'ava'
import fs from 'fs'

// under test
const convert = require('./nitfConvert').convert

test('convert simple article with one image', async t => {
  const article = await fs.readFileSync(__dirname + '/data/input-starline.json', 'utf8')
  const xml = await convert(JSON.parse(article))
  await fs.writeFileSync(__dirname + '/data/transformed-starline.xml', xml, function(err) {
      if(err) return console.log(err)
      console.log("The file was saved!")
  })
  t.truthy(xml)
  //const data = await fs.readFileSync(__dirname + '/data/output-starline.xml', 'utf8')
  //t.is(data, xml)
})

test('convert article with many images', async t => {
  const article = await fs.readFileSync(__dirname + '/data/input-infoline.json', 'utf8')
  const xml = await convert(JSON.parse(article))
  await fs.writeFileSync(__dirname + '/data/transformed-infoline.xml', xml, function(err) {
    if(err) return console.log(err)
    console.log("The file was saved!")
  })
  t.truthy(xml)
  //const data = await fs.readFileSync(__dirname + '/data/transformed-infoline.xml', 'utf8')
  //t.is(data, xml)
})
