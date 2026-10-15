'use strict';
// The compatibility check is a RUNTIME file (modules/artifact_compat.js): the consumer runs the check the publisher ran, from one file (T179, PENDING_DECISIONS #218). This re-export keeps the build tools' path.
module.exports = require('../../../modules/artifact_compat.js');
