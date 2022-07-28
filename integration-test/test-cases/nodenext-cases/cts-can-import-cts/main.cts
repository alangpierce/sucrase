import one, {two} from './file.cjs'

if (one + two !== 3) {
  throw new Error();
}
