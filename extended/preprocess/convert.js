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

// Change these functions to customize the transformation process

const convert = (article) => {
    // Converts the article to the required output format and returns it as string
    return JSON.stringify(article)
}

const getFileEnding = () => {
    // Returns the file ending of the required output format
    return '.json'
}

const processingAllowed = (article) => {
    // Returns whether processing of the article is allowed. 
    // This function might be used to suppress processing (e.g. of articles with no rubrications)
    return true
}

module.exports = {
    convert,
    getFileEnding,
    processingAllowed
}