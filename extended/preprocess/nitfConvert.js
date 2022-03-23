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
const escape = require('lodash.escape')
const moment = require('moment')
const template = require('lodash.template')
const sortBy = require('lodash.sortby')
const xpath = require('xpath')
const xmldom = require('xmldom')
const striptags = require('striptags')

const convert = (article) => {
  return xmlArticle({
    article: adaptArticle(article),
    selectMediaObject,
    filterForImagesize,
    escape
  })
}

const hasCurrentRubric = (article) => {
  return !!extractRubrics(article)
}

function adaptArticle (article) {
  const adapted = {
    ...article,
    origin: 'dpa - Deutsche Presse-Agentur GmbH',
    nitf_copyright: 'dpa-infocom GmbH',
    nitf_id: article.urn.replace(/[:.]/g, '-'),
    date_issue: moment(article.version_created).format('YYYYMMDDTHHmmssZZ'),
    keywords: extractKeywords(article.categories),
    nitf_description: extractDescription(article.article_html),
    teaser: article.teaser || '',
    kicker: article.kicker || '',
    article_body: extractSectionMain(article.article_html),
    link_box_objs: extractLinks(article.linkbox_html),
    fixtures: extractRubrics(article),
    media_objects: article.associations.map((assoc, i) => adaptAssociation(article, assoc, i))
  }
  return adapted
}

function adaptAssociation (article, assoc, i) {
  const image_id = assoc.urn.replace(/[:.]/g,'-')
  const adapted = {
    ...assoc,
    nitf_image_id: image_id,
    nitf_source: 'dpa-infocom',
    copyright: 'dpa-infocom GmbH',
    title: assoc.headline || '',
    description_full: assoc.caption + (assoc.creditline ? ' Foto: ' + assoc.creditline : '')
  }
  return adapted
}

function extractSectionMain (articleHtml) {
  if (!articleHtml) return ''
  const doc = new xmldom.DOMParser().parseFromString(articleHtml)
  const select = xpath.useNamespaces({})
  const nodes = select('//section[contains(@class, "main")]/*', doc)   // TODO  section.main !
  const serializer = new xmldom.XMLSerializer()
  const main = nodes.map(node => serializer.serializeToString(node)).join('\n               ')
  return main
}

function extractLinks(linkBoxHtml) {
  if (!linkBoxHtml) return []
  const doc = new xmldom.DOMParser().parseFromString(linkBoxHtml)
  const select = xpath.useNamespaces({})
  const nodes = select('//section[contains(@class, "linkbox")]//ul//li/*', doc)
  const serializer = new xmldom.XMLSerializer()
  const links = nodes.map(node => serializer.serializeToString(node))
  return links
}

function extractRubrics (article) {
  const rubrics = article.categories.filter((cat) => cat.type === 'dnltype:rubric')
  let currentRubrics = rubrics.filter((rub) => rub.is_current)
  if (currentRubrics.length === 0) return null
  currentRubrics = currentRubrics.map(rub => {
    const rubricPath = rub.qcode.replace(/^dnlpath:weblines./, '')
    return '/' + rubricPath.replace(/\./g, '/') +'/'
  })
  return currentRubrics
}

function extractKeywords (categories) {
  let cats = sortBy(categories.filter((cat) => cat.type === 'dnltype:dpasubject'), 'rank')
  cats = cats.concat(sortBy(categories.filter((cat) => cat.type === 'dnltype:keyword'), 'rank'))
  cats = cats.concat(sortBy(categories.filter((cat) => cat.type === 'dnltype:geosubject'), 'rank'))
  const keywords = cats.map(cat => cat.name)
  return keywords.join('/') + '/'
}

function extractDescription (articleHtml) {
  const main = extractSectionMain(articleHtml)
  let txt = striptags(main)
  txt = txt.slice(0, 135)
  const m = /^(.+\S+)\s.+$/.exec(txt)  // back to last compete word
  txt = m ? m[1] : txt
  return txt
}

function filterForImagesize (contents) {
  let selected = []
  if (selected.length === 0) {
    selected = contents.filter(c => c.size === 800)
  }
  if (selected.length === 0) {
    selected = contents.filter(c => c.width === 800)
  }
  if (selected.length === 0) {
    selected = contents.filter(c => c.width > 800)
  }
  if (selected.length === 0) {
    selected = contents.filter(c => c.height >= 600 && c.width >= 600)
  }
  if (selected.length === 0) {
    selected = contents.filter(c => c.size > 800)
  }
  return selected
}

function selectMediaObject (associations) {
  let selected = []
  if (selected.length === 0) {
    selected = associations.filter(assoc => assoc.is_featureimage)
  }
  if (selected.length === 0) {
    selected = associations
  }
  return selected.slice(0, 1)   // [first]
}

// approximation of the old nitf-format
const xmlArticle = template(`<nitf> 
  <head> 
    <title><%= escape(article.headline) %></title>  
    <meta content="<%= escape(article.nitf_origin) %>" name="origin"/>  
    <meta content="<%= escape(article.nitf_copyright) %>" name="copyright"/>  
    <meta content="service-wds" name="generator"/>  
    <docdata> 
      <doc-id id-string="<%= article.nitf_id %>" regsrc="dpa-infocom"/>  
      <urgency ed-urg="<%= article.urgency %>"/><% article.fixtures.forEach(fixture => { %><fixture fix-id="<%= escape(fixture) %>"/><% }) %>
      <date.issue norm="<%= article.date_issue %>"/>  
      <doc-scope scope="<%= article.desk_names %>"/>  
      <key-list> 
        <keyword key="<%= escape(article.keywords) %>"/> 
      </key-list> 
    </docdata> 
  </head>  
  <body> 
    <body.head> 
      <hedline> 
        <hl1><%= escape(article.headline) %></hl1>  
        <hl2 class="ShortHeadLine"><%= escape(article.kicker) %></hl2> 
      </hedline> <% if (article.teaser) { %>
      <abstract> 
        <p><%= escape(article.teaser) %></p> 
      </abstract><% } %>
    </body.head>  
    <body.content>
      <%= article.article_body %>
      <block style="EXTERNAL-LINKS"> <% article.link_box_objs.forEach(a_link => { %>
        <p> 
          <%= a_link %>
        </p> <% }) %>
      </block>  <% article.media_objects.filter(m_obj => m_obj.type === 'image').forEach(m_obj => { %>
      <% filterForImagesize(m_obj.renditions).forEach(content => { %><media media-type="image"> 
       <media-metadata name="media-id" value="<%= m_obj.nitf_image_id %>"/>
       <media-reference alternate-text="<%= escape(m_obj.headline) %>" height="<%= content.height %>" mime-type="image/jpeg" source="<%= escape(content.url) %>" width="<%= content.width %>"/>  
       <media-caption> 
         <p><%= escape(m_obj.caption) %> Foto: <%= escape(m_obj.creditline) %></p> 
       </media-caption>  
       <media-producer> 
         <person><%= escape(m_obj.creditline) %></person> 
       </media-producer> 
     </media> <% }) %><% }) %>
    </body.content>  
    <body.end/> 
  </body> 
</nitf>`)

const getFileEnding = () => {
  return ".xml"
}

const processingAllowed = (article) => {
  // Allow article processing only if article is in one or more rubrics - suppresses complete derubrications
  return hasCurrentRubric(article)
}

module.exports = { 
    convert,
    getFileEnding,
    processingAllowed
}
