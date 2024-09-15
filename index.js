import fs from 'node:fs';
import { parse } from 'csv-parse';

const __dirname = new URL('.', import.meta.url).pathname;

const nonWords = [
  'viešoji',
  'įstaiga',
  'uždaroji',
  'akcinė',
  'bendrovė',
  'bendruomenė',
  'uab',
  'bendra',
  'įmonė',
  'ir',
  'akcinė',
  'kooperatinė',
  'ab',
  'mb',
  'draudimo',
  'individuali',
  'savininkų',
  'bendrija',
  'bendrovės',
  'asociacija',
  'všį',
  'profesinė',
  'daugiabučių',
  'daugiabučio',
  'klubas',
  'centras',
  'rajono',
  'iį',
];
const setNonWords = new Set(nonWords);

const processJarFile = async () => {
  const companiesByCode = {};

  const parser = fs.createReadStream(`${__dirname}/input/jar.csv`).pipe(
    parse({
      delimiter: '|',
      columns: true,
    }),
  );

  for await (const record of parser) {
    companiesByCode[record.ja_kodas] = {
      name: record.ja_pavadinimas,
      code: record.ja_kodas,
      address: record.adresas,
    };
  }

  return companiesByCode;
};

const processVMIFile = async (companiesByCode) => {
  const parser = fs.createReadStream(`${__dirname}/input/vmi.csv`).pipe(
    parse({
      delimiter: ',',
      columns: true,
    }),
  );

  for await (const record of parser) {
    const company = companiesByCode[record.ja_kodas];
    const vatcode =
      record.pvm_isregistruota || !record.pvm_kodas
        ? undefined
        : `${record.pvm_kodas_pref}${record.pvm_kodas}`;
    if (!company) {
      if (!record.isreg_data) {
        // VMI turi naujesnius duomenis. Trūksta tik adreso.
        companiesByCode[record.ja_kodas] = {
          name: record.pavadinimas,
          code: record.ja_kodas,
          vatcode,
        };
      }
    } else {
      company.name = record.pavadinimas; // VMI geresni pavadinimai
      company.vatcode = vatcode;
    }
  }
};

const addCompanyByPrefix = (companiesByPrefix, start, word, company) => {
  if (!companiesByPrefix[start]) {
    companiesByPrefix[start] = {};
  }

  companiesByPrefix[start][`${word}_${company.name}`] = company;
};

/**
 * @param {string[]} words
 */
const addCompany = (companiesByPrefix, words, company) => {
  for (const word of words) {
    if (word.length > 1) {
      addCompanyByPrefix(companiesByPrefix, word.slice(0, 2), word, company);
    }
    if (word.length > 2) {
      addCompanyByPrefix(companiesByPrefix, word.slice(0, 3), word, company);
    }
    if (word.length > 3) {
      addCompanyByPrefix(companiesByPrefix, word.slice(0, 4), word, company);
    }
  }
};

const processCompanies = (companiesByCode) => {
  const companiesByPrefix = {};

  for (const code in companiesByCode) {
    const company = companiesByCode[code];
    const name = company.name;

    const words = name
      .toLowerCase()
      .replaceAll('"', '')
      .replaceAll("''", '')
      .replaceAll('/', '')
      .replaceAll('(', '')
      .replaceAll(')', '')
      .replaceAll("'", ' ')
      .replaceAll(',', ' ')
      .replaceAll('&', ' ')
      .replaceAll('-', ' ')
      .replaceAll('.', ' ')
      .split(' ')
      .filter((w) => w && !setNonWords.has(w));

    addCompany(companiesByPrefix, words, company);
  }

  return companiesByPrefix;
};

const writeCompaniesByPrefixToFS = (companiesByPrefix) => {
  for (const prefix in companiesByPrefix) {
    const companies = companiesByPrefix[prefix];
    let companyList = Object.keys(companies).sort();

    if (prefix.length < 4 && companyList.length > 100) {
      companyList = companyList.filter((n) => n.startsWith(`${prefix}_`));
    }

    companyList = companyList.map((k) => companies[k]);

    const fn = `${__dirname}data/${prefix}.json`;
    fs.writeFileSync(fn, JSON.stringify(companyList, null, 2), {
      encoding: 'utf-8',
    });
  }
};

const generateOrgJsons = async () => {
  const companiesByCode = await processJarFile();
  await processVMIFile(companiesByCode);

  const companiesByPrefix = processCompanies(companiesByCode);

  writeCompaniesByPrefixToFS(companiesByPrefix);
};

await generateOrgJsons();
